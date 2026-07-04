import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { loadRoutes } from "./loadRoutes";
import { validateEnv } from "./env";
import logger from "./logger";

export interface AppOptions {
  routesDir?: string;
  basePath?: string;
  cors?: Parameters<typeof cors>[0] | boolean;
  /** "basic": one metadata line per request (no body). false: off. */
  logRequests?: "basic" | false;
  docs?: { path?: string; specPath?: string; title?: string; theme?: string } | false;
  env?: { required?: string[] };
}

/**
 * Builds the Hono app (middleware + routes + docs) without listening. `serve`
 * wraps this; tests call it directly and drive it with `app.request(...)`.
 */
export async function createApp(opts: AppOptions = {}): Promise<OpenAPIHono> {
  if (opts.env?.required) validateEnv(opts.env.required);

  const app = new OpenAPIHono();

  if (opts.cors !== false) {
    app.use("*", cors(opts.cors === true || opts.cors === undefined ? { origin: "*" } : opts.cors));
  }

  // Request id + lightweight logging. Perf: never reads/parses the body here —
  // handlers (via their zod schema) parse it lazily, only when they declare one.
  const logRequests = opts.logRequests ?? "basic";
  app.use("*", async (c, next) => {
    c.set("process_id" as never, crypto.randomUUID() as never);
    const start = Date.now();
    await next();
    if (logRequests !== false) {
      logger.info({
        message: `${c.req.method} ${c.req.path} ${c.res.status}`,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Date.now() - start,
        process_id: c.get("process_id" as never),
      });
    }
  });

  const routes = await loadRoutes(app, {
    routesDir: opts.routesDir ?? "./api",
    basePath: opts.basePath ?? "/api",
  });
  logger.info({ message: `Loaded ${routes.length} routes` });

  if (opts.docs !== false) {
    const d = opts.docs ?? {};
    const docsPath = d.path ?? "/api/docs";
    const specPath = d.specPath ?? "/api/doc";
    const title = d.title ?? "baguette API";
    app.doc(specPath, { openapi: "3.1.0", info: { title, version: "v1" } });
    app.get(docsPath, Scalar({ url: specPath, theme: (d.theme ?? "purple") as never, pageTitle: title }));
  }

  return app;
}
