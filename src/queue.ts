import { Glob } from "bun";
import path from "node:path";
import type BeeQueue from "bee-queue";
import logger from "./logger";
import processError from "./processError";

/*
 * Opt-in job queues on bee-queue + Redis. Reachable only via
 * `@prehoy/baguette/queue`; bee-queue is an OPTIONAL peer dep, loaded lazily.
 *
 *   // queues/send-welcome.ts  — one queue per file
 *   export default defineQueue<{ userId: string }>({
 *     name: "send-welcome",
 *     concurrency: 5,
 *     process: async ({ userId }) => { ... },
 *   });
 *
 *   // producer, anywhere:
 *   import sendWelcome from "../queues/send-welcome";
 *   await sendWelcome.add({ userId });     // typed
 *
 *   // worker: serve() auto-starts queues/ if the dir exists, or startQueues().
 */

async function loadBee() {
  try {
    return (await import("bee-queue")).default;
  } catch {
    throw new Error("Queues need bee-queue — `bun add bee-queue`");
  }
}

// Redis for both producer and worker. bee-queue accepts a URL string or options.
function redisConfig(): any {
  const url = Bun.env.QUEUE_REDIS_URL ?? Bun.env.REDIS_URL;
  if (url) return url;
  return {
    host: Bun.env.REDIS_HOST ?? "127.0.0.1",
    port: Number(Bun.env.REDIS_PORT ?? 6379),
    password: Bun.env.REDIS_PASSWORD || undefined,
  };
}

export interface QueueConfig<T> {
  /** Bee-queue name (the Redis key namespace). */
  name: string;
  /** Jobs processed in parallel per worker (default 1). */
  concurrency?: number;
  /** Default retries / timeout for jobs added to this queue. */
  retries?: number;
  timeout?: number;
  process: (data: T, job: BeeQueue.Job<T>) => Promise<unknown>;
}

export interface AddOptions {
  /** Milliseconds to wait before the job becomes eligible. */
  delay?: number;
  retries?: number;
  timeout?: number;
}

const QUEUE = Symbol.for("baguette.queue");

export interface QueueHandle<T> {
  readonly name: string;
  /** Enqueue a job (producer). Lazily opens a producer connection. Returns job id. */
  add(data: T, opts?: AddOptions): Promise<string>;
  /** @internal */
  [QUEUE]: QueueConfig<T>;
}

export function defineQueue<T = unknown>(config: QueueConfig<T>): QueueHandle<T> {
  let producer: BeeQueue<T> | undefined;
  return {
    name: config.name,
    [QUEUE]: config,
    async add(data, opts) {
      if (!producer) {
        const Bee = await loadBee();
        // isWorker:false -> this connection only enqueues, never processes.
        producer = new Bee<T>(config.name, {
          redis: redisConfig(),
          isWorker: false,
          getEvents: false,
          removeOnSuccess: true,
        });
      }
      let job = producer.createJob(data);
      const retries = opts?.retries ?? config.retries;
      const timeout = opts?.timeout ?? config.timeout;
      if (retries != null) job = job.retries(retries);
      if (timeout != null) job = job.timeout(timeout);
      if (opts?.delay) job = job.delayUntil(Date.now() + opts.delay);
      const saved = await job.save();
      return String(saved.id);
    },
  };
}

export function isQueue(x: any): x is QueueHandle<any> {
  return !!x && !!x[QUEUE];
}

/** Load `queues/*.ts` into their handles (no Redis connection). Testable seam. */
export async function loadQueues(dir: string): Promise<QueueHandle<any>[]> {
  const abs = path.resolve(dir);
  const out: QueueHandle<any>[] = [];
  for await (const rel of new Glob("**/*.ts").scan({ cwd: abs })) {
    if (rel.endsWith(".test.ts")) continue;
    const mod = await import(path.join(abs, rel));
    if (isQueue(mod.default)) out.push(mod.default);
    else logger.warn({ message: `Queue file ${rel} has no default defineQueue; skipped` });
  }
  return out;
}

export interface QueueController {
  workers: BeeQueue<any>[];
  count: number;
  /** Close all worker connections (call from serve's onShutdown). */
  close: () => Promise<void>;
}

/** Start a worker per `queues/*.ts`, wiring its processor + stalled-job checks. */
export async function startQueues(opts: { dir?: string; redis?: any } = {}): Promise<QueueController> {
  const Bee = await loadBee();
  const handles = await loadQueues(opts.dir ?? "./queues");
  const workers: BeeQueue<any>[] = [];
  for (const h of handles) {
    const cfg = h[QUEUE];
    const worker = new Bee(cfg.name, {
      redis: opts.redis ?? redisConfig(),
      removeOnSuccess: true,
      getEvents: false,
    });
    worker.process(cfg.concurrency ?? 1, async (job: BeeQueue.Job<any>) => {
      try {
        return await cfg.process(job.data, job);
      } catch (e) {
        logger.error({ message: `Queue ${cfg.name} job ${job.id} failed`, error: processError(e) });
        throw e; // let bee-queue handle retry/backoff
      }
    });
    worker.checkStalledJobs(5000, (err) => {
      if (err) logger.error({ message: `Stalled-job check failed for ${cfg.name}`, error: String(err) });
    });
    workers.push(worker);
    logger.info({ message: `Queue worker: ${cfg.name} (concurrency ${cfg.concurrency ?? 1})` });
  }
  logger.info({ message: `Started ${workers.length} queue worker(s)` });
  return {
    workers,
    count: workers.length,
    close: async () => {
      await Promise.all(workers.map((w) => w.close()));
    },
  };
}
