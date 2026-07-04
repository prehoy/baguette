import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { AuthResolver } from "./defineRoute";
import { loadRoutes } from "./loadRoutes";
import type { RateLimitStore } from "./rateLimit";
import { validateEnv } from "./env";
import logger from "./logger";

type HonoCors = NonNullable<Parameters<typeof cors>[0]>;
/** CORS options, plus `reflect: true` to echo the request Origin (valid with credentials). */
export type CorsOption = boolean | (HonoCors & { reflect?: boolean });

export interface AppOptions {
  routesDir?: string;
  basePath?: string;
  cors?: CorsOption;
  /** Resolve the current user; required if any route sets `auth: true`. */
  auth?: AuthResolver;
  /** Add HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, etc. */
  securityHeaders?: boolean;
  /** Reject request bodies larger than this many bytes with 413. */
  bodyLimit?: number;
  /** Backing store for per-route `rateLimit` (default: memory, or redis via env). */
  rateLimitStore?: RateLimitStore;
  /** Serve a static SPA (root dir) with an index.html fallback, mounted last. */
  spa?: string;
  /**
   * Opt into WebSockets (off by default — no upgrade surface unless set).
   * `true` mounts the built-in room/channel pub/sub at /api/ws/:room/:channel.
   * `{ path }` customizes it; `{ pubsub: false }` wires the ws handler only, for
   * custom `upgradeWebSocket` routes you mount via `onApp`.
   */
  ws?: boolean | { path?: string; pubsub?: boolean };
  /** Escape hatch: mount custom middleware/static on the app before it listens. */
  onApp?: (app: OpenAPIHono) => void | Promise<void>;
  /** "basic": one metadata line per request (no body). false: off. */
  logRequests?: "basic" | false;
  docs?: { path?: string; specPath?: string; title?: string; theme?: string } | false;
  env?: { required?: string[] };
}

// Guard the classic footgun: origin:"*" + credentials is invalid per the CORS
// spec (browsers reject it). `reflect:true` echoes the Origin, which is valid.
function resolveCors(opt: CorsOption | undefined): HonoCors {
  if (opt === undefined || opt === true || opt === false) return { origin: "*" };
  const { reflect, ...rest } = opt;
  const wildcard = rest.origin === undefined || rest.origin === "*";
  if (rest.credentials && wildcard && !reflect) {
    throw new Error(
      'CORS: `credentials: true` is invalid with `origin: "*"`. Use `{ credentials: true, reflect: true }` ' +
        "to echo the request Origin, or set explicit `origin`s.",
    );
  }
  if (reflect) return { ...rest, origin: (o: string) => o };
  return rest;
}

/**
 * Builds the Hono app (middleware + routes + docs) without listening. `serve`
 * wraps this; tests call it directly and drive it with `app.request(...)`.
 */
export async function createApp(opts: AppOptions = {}): Promise<OpenAPIHono> {
  if (opts.env?.required) validateEnv(opts.env.required);

  // Format request-validation failures into the clean { error, issues } shape
  // (matching ErrorSchema) instead of leaking the raw ZodError blob to clients.
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        const issues = result.error.issues.map((i) => ({
          field: i.path.join(".") || "(body)",
          message: i.message,
        }));
        const first = issues[0];
        return c.json(
          { error: first ? `${first.field}: ${first.message}` : "Invalid request", issues },
          400,
        );
      }
    },
  });

  if (opts.securityHeaders) app.use("*", secureHeaders());
  if (opts.cors !== false) app.use("*", cors(resolveCors(opts.cors)));
  if (opts.bodyLimit)
    app.use(
      "*",
      bodyLimit({ maxSize: opts.bodyLimit, onError: (c) => c.json({ error: "Payload too large" }, 413) }),
    );

  // Request id + lightweight logging. Perf: never reads/parses the body here —
  // handlers (via their zod schema) parse it lazily, only when they declare one.
  const logRequests = opts.logRequests ?? "basic";
  app.use("*", async (c, next) => {
    c.set("process_id", crypto.randomUUID());
    const start = Date.now();
    await next();
    if (logRequests !== false) {
      logger.info({
        message: `${c.req.method} ${c.req.path} ${c.res.status}`,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Date.now() - start,
        process_id: c.get("process_id"),
      });
    }
  });

  const routes = await loadRoutes(app, {
    routesDir: opts.routesDir ?? "./api",
    basePath: opts.basePath ?? "/api",
    auth: opts.auth,
    rateLimitStore: opts.rateLimitStore,
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

  if (opts.ws && (typeof opts.ws !== "object" || opts.ws.pubsub !== false)) {
    const { pubSubWebSocket } = await import("./websocket");
    const wsPath = (typeof opts.ws === "object" && opts.ws.path) || "/api/ws/:room/:channel";
    app.get(wsPath, pubSubWebSocket());
    logger.info({ message: `WebSocket pub/sub mounted at ${wsPath}` });
  }

  // Custom mounting (cache headers, extra static, etc.) runs after the API so it
  // can't shadow it, and before the SPA fallback so it can't be shadowed by it.
  await opts.onApp?.(app);

  if (opts.spa) {
    const root = opts.spa;
    app.use("*", serveStatic({ root }));
    app.get("*", serveStatic({ path: `${root}/index.html` }) as MiddlewareHandler); // SPA deep-link fallback
  }

  return app;
}
