import { Glob } from "bun";
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

// Postgres advisory locks replace a CronLock table + TTL cleanup entirely: the
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

export async function startCron(opts: CronOptions = {}): Promise<void> {
  const dir = opts.dir ?? "./cron";
  const lock = opts.lock ?? (opts.db ? pgAdvisoryLock(opts.db) : undefined);
  if (!lock) logger.warn({ message: "startCron: no db/lock — jobs may double-run across replicas" });

  const jobs = await loadCronJobs(dir);
  for (const job of jobs) {
    new CronJob(job.details.cron.value, () => runCronJob(job, { lock, isEnabled: opts.isEnabled, onRun: opts.onRun }), null, true);
    logger.info({ message: `Scheduled cron ${job.details.name} (${job.details.cron.value})` });
  }
  logger.info({ message: `Started ${jobs.length} cron job(s)` });
}
