import { existsSync } from "node:fs";
import path from "node:path";
import { createApp, type AppOptions } from "./createApp";
import logger from "./logger";

export interface ServeOptions extends AppOptions {
  port?: number;
  /** Cron: auto-on if ./cron exists. false to disable; {db} to set the lock DB. */
  cron?: boolean | { db?: string; dir?: string };
  /** Automations are opt-in (need the table list). Omit to leave them off. */
  automations?: { db: string; tables: string[]; dir?: string };
}

/** Build the app and start listening. Returns the app for further wiring/tests. */
export default async function serve(opts: ServeOptions = {}) {
  const app = await createApp(opts);
  const port = opts.port ?? (Number(Bun.env.PORT) || 3000);
  Bun.serve({ port, fetch: app.fetch, reusePort: true });
  logger.info({ message: `baguette listening on :${port}` });

  // Optional layers — dynamic-imported so HTTP-only apps never load them.
  const cronDir = (typeof opts.cron === "object" && opts.cron.dir) || "./cron";
  if (opts.cron !== false && existsSync(path.resolve(cronDir))) {
    const { startCron } = await import("./cron");
    await startCron({
      dir: cronDir,
      db: (typeof opts.cron === "object" ? opts.cron.db : undefined) ?? Bun.env.DATABASE_URL,
    });
  }
  if (opts.automations) {
    const { startAutomations } = await import("./automations");
    await startAutomations(opts.automations);
  }

  return app;
}
