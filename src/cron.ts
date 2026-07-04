import { Glob, RedisClient } from "bun";
import { Database } from "bun:sqlite";
import path from "node:path";
import { CronJob } from "cron";
import postgres from "postgres";
import logger from "./logger";
import processError from "./processError";

export interface CronDefinition {
  details: { name: string; log?: boolean; cron: { value: string; tag?: string } };
  process: () => Promise<unknown>;
}

/** Runs `fn` only if it wins the lock — otherwise another replica has this job. */
export type LockRunner = (key: string, fn: () => Promise<void>) => Promise<void>;

export interface CronOptions {
  dir?: string;
  /** Postgres connection string or a `postgres` client, for the advisory lock. */
  db?: string | postgres.Sql;
  /** Override the lock (e.g. a no-op for single-node, or a Redis lock). */
  lock?: LockRunner;
  /** Gate a job at runtime (default: always on). */
  isEnabled?: (name: string) => boolean | Promise<boolean>;
  onRun?: (name: string, result: unknown) => void;
}

const LOCK_TTL_SEC = 300; // stale-lock reclaim for backends that persist a row

// In-process lock — the zero-config default. Prevents a job from overlapping
// itself on THIS instance. Does NOT coordinate across replicas (each process has
// its own Set), so it's for single-instance deploys. Scale out -> pick a shared
// backend (postgres/redis) via CRON_LOCK.
export function memoryLock(): LockRunner {
  const held = new Set<string>();
  return async (key, fn) => {
    if (held.has(key)) return;
    held.add(key);
    try {
      await fn();
    } finally {
      held.delete(key);
    }
  };
}

// Postgres advisory lock — SHARED across every replica on the same DB. The
// xact-scoped lock auto-releases when the transaction ends. ORM-agnostic (raw SQL).
export function pgAdvisoryLock(db: string | postgres.Sql): LockRunner {
  const sql = typeof db === "string" ? postgres(db) : db;
  return async (key, fn) => {
    await sql.begin(async (tx) => {
      const [row] = await tx`select pg_try_advisory_xact_lock(hashtext(${key})) as ok`;
      if (!row?.ok) return; // held elsewhere — skip this tick
      await fn();
    });
  };
}

// Redis lock — SHARED across replicas pointing at the same Redis. SET NX EX is
// the canonical distributed lock; released with a compare-and-delete so we never
// drop someone else's lock after a TTL lapse. Uses Bun's built-in client (no dep).
export function redisLock(url: string, ttlSec = LOCK_TTL_SEC): LockRunner {
  const client = new RedisClient(url);
  return async (key, fn) => {
    const lk = `baguette:cron:${key}`;
    const token = crypto.randomUUID();
    const ok = await client.send("SET", [lk, token, "NX", "EX", String(ttlSec)]);
    if (ok !== "OK") return; // held elsewhere
    try {
      await fn();
    } finally {
      // release only if the lock is still ours (avoids releasing after a stall)
      await client.send("EVAL", [
        "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
        "1",
        lk,
        token,
      ]);
    }
  };
}

// SQLite lock — persists across restarts on ONE node (or a shared volume). NOT a
// cross-machine distributed lock: separate pods have separate files. Good for a
// single instance that wants the lock to survive a crash. Bun's built-in sqlite.
export function sqliteLock(file: string, ttlSec = LOCK_TTL_SEC): LockRunner {
  const db = new Database(file);
  db.run("CREATE TABLE IF NOT EXISTS cron_locks (slug TEXT PRIMARY KEY, acquired_at INTEGER)");
  return async (key, fn) => {
    const now = Math.floor(Date.now() / 1000);
    db.run("DELETE FROM cron_locks WHERE slug = ? AND acquired_at < ?", [key, now - ttlSec]);
    const res = db.run("INSERT OR IGNORE INTO cron_locks (slug, acquired_at) VALUES (?, ?)", [key, now]);
    if (res.changes === 0) return; // row already present -> held
    try {
      await fn();
    } finally {
      db.run("DELETE FROM cron_locks WHERE slug = ?", [key]);
    }
  };
}

/**
 * Pick the lock backend from env. Default `memory` — cron works out of the box
 * on a single instance with no infra. Opt into a shared/persistent backend when
 * you scale out:
 *
 *   CRON_LOCK=memory                     (default) in-process, single instance
 *   CRON_LOCK=none                       no lock — every tick fires
 *   CRON_LOCK=postgres  + DATABASE_URL   advisory lock, shared across replicas
 *   CRON_LOCK=redis     + REDIS_URL      SET NX EX, shared across replicas
 *   CRON_LOCK=sqlite    [+ CRON_LOCK_SQLITE_PATH]  persists on one node/volume
 *
 * Per-backend URL overrides: CRON_LOCK_DATABASE_URL, CRON_LOCK_REDIS_URL.
 */
export function lockFromEnv(): LockRunner {
  const kind = (Bun.env.CRON_LOCK ?? "memory").toLowerCase();
  const need = (v: string | undefined, name: string) => {
    if (!v) throw new Error(`CRON_LOCK=${kind} requires ${name} to be set`);
    return v;
  };
  switch (kind) {
    case "memory":
      return memoryLock();
    case "none":
      return async (_k, fn) => fn();
    case "postgres":
    case "pg":
      return pgAdvisoryLock(need(Bun.env.CRON_LOCK_DATABASE_URL ?? Bun.env.DATABASE_URL, "DATABASE_URL"));
    case "redis":
      return redisLock(need(Bun.env.CRON_LOCK_REDIS_URL ?? Bun.env.REDIS_URL, "REDIS_URL"));
    case "sqlite":
      return sqliteLock(Bun.env.CRON_LOCK_SQLITE_PATH ?? ".baguette-cron.sqlite");
    default:
      throw new Error(`Unknown CRON_LOCK="${kind}" (use memory|none|postgres|redis|sqlite)`);
  }
}

export async function loadCronJobs(dir: string): Promise<CronDefinition[]> {
  const jobs: CronDefinition[] = [];
  for await (const rel of new Glob("**/*.ts").scan({ cwd: path.resolve(dir) })) {
    if (rel.endsWith(".test.ts")) continue;
    const mod = (await import(path.join(path.resolve(dir), rel))) as CronDefinition;
    if (mod?.details?.name && typeof mod.process === "function") jobs.push(mod);
    else logger.warn({ message: `Cron file ${rel} missing details/process; skipped` });
  }
  return jobs;
}

// One tick, factored out so it's testable without a scheduler or a clock.
export async function runCronJob(
  job: CronDefinition,
  ctx: Pick<CronOptions, "lock" | "isEnabled" | "onRun">,
): Promise<void> {
  const name = job.details.name;
  if (ctx.isEnabled && !(await ctx.isEnabled(name))) return;
  const run = async () => {
    try {
      const result = await job.process();
      ctx.onRun?.(name, result);
    } catch (e) {
      logger.error({ message: `Error in cron job ${name}`, error: processError(e) });
    }
  };
  await (ctx.lock ? ctx.lock(name, run) : run());
}

export interface CronController {
  /** Trigger a loaded job by name right now (e.g. from a route). Respects the lock. */
  trigger: (name: string) => Promise<void>;
  jobs: string[];
}

export async function startCron(opts: CronOptions = {}): Promise<CronController> {
  const dir = opts.dir ?? "./cron";
  // Precedence: explicit lock > explicit db (postgres) > CRON_LOCK env (default memory).
  const lock = opts.lock ?? (opts.db ? pgAdvisoryLock(opts.db) : lockFromEnv());
  logger.info({ message: `Cron lock backend: ${opts.lock ? "custom" : opts.db ? "postgres" : (Bun.env.CRON_LOCK ?? "memory")}` });

  const jobs = await loadCronJobs(dir);
  const byName = new Map(jobs.map((j) => [j.details.name, j]));
  const ctx = { lock, isEnabled: opts.isEnabled, onRun: opts.onRun };
  for (const job of jobs) {
    new CronJob(job.details.cron.value, () => runCronJob(job, ctx), null, true);
    logger.info({ message: `Scheduled cron ${job.details.name} (${job.details.cron.value})` });
  }
  logger.info({ message: `Started ${jobs.length} cron job(s)` });

  return {
    jobs: [...byName.keys()],
    trigger: async (name) => {
      const job = byName.get(name);
      if (!job) throw new Error(`No cron job named "${name}"`);
      await runCronJob(job, ctx);
    },
  };
}
