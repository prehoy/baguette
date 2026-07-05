import { existsSync } from "node:fs";
import path from "node:path";
import { createApp, type AppOptions } from "./createApp";
import logger from "./logger";
import processError from "./processError";

export interface ServeOptions extends AppOptions {
  port?: number;
  /** Runs before the app is built + listens — migrations, seed, warmup. */
  onBoot?: () => void | Promise<void>;
  /** Runs on SIGTERM/SIGINT after the server stops accepting — close DB/cron. */
  onShutdown?: () => void | Promise<void>;
  /** Cron: auto-on if ./cron exists. false to disable; {db} to set the lock DB. */
  cron?: boolean | { db?: string; dir?: string };
  /** Automations are opt-in (need the table list). Omit to leave them off. */
  automations?: { db: string; tables: string[]; dir?: string };
  /** Queues: auto-on if ./queues exists. false to disable; {dir}/{redis} to configure. */
  queues?: boolean | { dir?: string; redis?: any };
}

/** Build the app and start listening. Returns the app for further wiring/tests. */
export default async function serve(opts: ServeOptions = {}) {
  await opts.onBoot?.(); // migrations / seed / warmup, before we accept traffic

  const app = await createApp(opts);
  const port = opts.port ?? (Number(Bun.env.PORT) || 3000);
  // WebSockets are opt-in: only wire Bun's ws handler (and load the ws module) when
  // `ws` is set, so non-WS apps expose no upgrade surface at all.
  const base = { port, fetch: app.fetch, reusePort: true } as const;
  const server = opts.ws
    ? Bun.serve({ ...base, websocket: (await import("./websocket")).websocket })
    : Bun.serve(base);
  logger.info({ message: `baguette listening on :${port}` });

  // Optional layers — dynamic-imported so HTTP-only apps never load them.
  const cronDir = (typeof opts.cron === "object" && opts.cron.dir) || "./cron";
  if (opts.cron !== false && existsSync(path.resolve(cronDir))) {
    const { startCron } = await import("./cron");
    await startCron({
      dir: cronDir,
      db: typeof opts.cron === "object" ? opts.cron.db : undefined,
    });
  }
  if (opts.automations) {
    const { startAutomations } = await import("./automations");
    await startAutomations(opts.automations);
  }
  const queuesDir = (typeof opts.queues === "object" && opts.queues.dir) || "./queues";
  let queueController: { close: () => Promise<void> } | undefined;
  if (opts.queues !== false && existsSync(path.resolve(queuesDir))) {
    const { startQueues } = await import("./queue");
    queueController = await startQueues({
      dir: queuesDir,
      redis: typeof opts.queues === "object" ? opts.queues.redis : undefined,
    });
  }

  // Graceful shutdown: stop accepting, run the hook, exit. Registered once.
  let closing = false;
  const shutdown = async (sig: string) => {
    if (closing) return;
    closing = true;
    logger.info({ message: `${sig} received — draining` });
    try {
      server.stop();
      await queueController?.close();
      await opts.onShutdown?.();
    } catch (e) {
      logger.error({ message: "Error during shutdown", error: processError(e) });
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  return app;
}
