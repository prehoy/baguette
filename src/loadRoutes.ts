import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createRoute, type OpenAPIHono, type z } from "@hono/zod-openapi";
import type { Context, MiddlewareHandler } from "hono";
import { isBaguetteRoute, type AuthResolver, type RouteDescriptor } from "./defineRoute";
import { ErrorSchema } from "./errorSchema";
import { rateLimit, type RateLimitStore } from "./rateLimit";
import routeHandler from "./routeHandler";
import logger from "./logger";

/**
 * File-based router. Scans `routesDir` recursively; each file's location becomes
 * its URL path (`[id]` folders/files -> `{id}`). Imports run in parallel (fast
 * cold start); mounting stays sequential (stable order, static before params).
 */
export async function loadRoutes(
  app: OpenAPIHono,
  opts: { routesDir: string; basePath?: string; auth?: AuthResolver; rateLimitStore?: RateLimitStore },
): Promise<string[]> {
  const dir = path.resolve(opts.routesDir);
  const base = opts.basePath ?? "/api";

  const files = (await collect(dir)).sort(sortStaticFirst);
  // Perf: parallelize the slow part (dynamic import), then mount synchronously.
  const mods = await Promise.all(
    files.map(async (rel) => {
      try {
        return { rel, mod: await import(path.join(dir, rel)) };
      } catch (e) {
        logger.error({ message: `Failed to load route ${rel}`, error: String(e) });
        return null;
      }
    }),
  );

  const mounted: string[] = [];
  for (const entry of mods) {
    if (!entry) continue;
    const routePath = derivePath(entry.rel, base);
    const def = entry.mod.default;
    if (isBaguetteRoute(def)) {
      if (def.auth && !opts.auth)
        throw new Error(`Route ${routePath} has auth:true but no auth resolver was configured (serve({ auth }))`);
      mountRoute(app, routePath, def, opts.auth, opts.rateLimitStore);
      mounted.push(`${def.method.toUpperCase()} ${routePath}`);
    } else if (typeof def === "function") {
      // Raw escape hatch (lint-flagged): schema-less handler, e.g. a webhook
      // that must swallow any payload.
      app.all(routePath, def as any);
      mounted.push(`ALL ${routePath}`);
    } else {
      logger.warn({ message: `Route ${entry.rel} has no default export; skipped` });
    }
  }
  return mounted;
}

function mountRoute(
  app: OpenAPIHono,
  routePath: string,
  def: RouteDescriptor,
  authResolver?: AuthResolver,
  rateLimitStore?: RateLimitStore,
) {
  const route = createRoute({
    method: def.method,
    path: routePath,
    summary: def.summary,
    tags: def.tags,
    request: buildRequest(def.request),
    responses: buildResponses(def.response),
  });

  // Rate limit runs FIRST — before auth — so brute-force/email-bombing is capped
  // before it ever reaches the auth resolver or handler.
  const chain: MiddlewareHandler[] = [];
  if (def.rateLimit) chain.push(rateLimit(def.rateLimit, rateLimitStore));

  // Declarative auth as a middleware: resolver runs, 401 short-circuits, else the
  // user is set on the context. Kills the per-handler requireAuth() bug class.
  if (def.auth)
    chain.push(async (c, next) => {
      const user = await authResolver!(c);
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      c.set("user", user);
      await next();
    });
  if (def.middleware) chain.push(...def.middleware);

  // Cast at the framework boundary so app code never needs one: zod-openapi's
  // handler return type can't see through our routeHandler wrapper.
  app.openapi(route, (async (c: any) => {
    const input = {
      params: def.request?.params ? c.req.valid("param") : undefined,
      query: def.request?.query ? c.req.valid("query") : undefined,
      body: def.request?.body ? c.req.valid("json") : undefined,
    };
    const final = () => routeHandler({ name: routePath, c, handler: () => def.handler(c, input) });
    return chain.length ? runChain(c, chain, final) : final();
  }) as any);
}

// Standard onion: run middleware in order. A middleware may short-circuit (return
// its own Response, e.g. 401) or pass through via next(). We capture the Response
// from whichever path produced it so it's never lost.
async function runChain(
  c: Context,
  mws: MiddlewareHandler[],
  final: () => Promise<unknown>,
): Promise<unknown> {
  const dispatch = async (i: number): Promise<unknown> => {
    const mw = mws[i];
    if (!mw) return final();
    let downstream: unknown;
    const ret = await mw(c, (async () => {
      downstream = await dispatch(i + 1);
    }) as any);
    if (ret instanceof Response) return ret; // middleware short-circuited
    if (downstream !== undefined) return downstream; // passed through next()
    return c.res; // middleware finalized via c.res
  };
  return dispatch(0);
}

function buildRequest(req: RouteDescriptor["request"]) {
  if (!req) return undefined;
  const out: Record<string, unknown> = {};
  if (req.params) out.params = req.params;
  if (req.query) out.query = req.query;
  if (req.body)
    out.body = { content: { "application/json": { schema: req.body } }, required: true };
  return out as any;
}

function buildResponses(response: RouteDescriptor["response"]) {
  const responses: Record<number, unknown> = {
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  };
  if (!response) {
    responses[200] = { description: "OK" };
  } else if (isZodSchema(response)) {
    responses[200] = {
      description: "OK",
      content: { "application/json": { schema: response } },
    };
  } else {
    for (const [code, schema] of Object.entries(response)) {
      responses[Number(code)] = {
        description: "OK",
        content: { "application/json": { schema } },
      };
    }
  }
  return responses as any;
}

function isZodSchema(x: unknown): x is z.ZodType {
  return typeof (x as any)?.parse === "function" && typeof (x as any)?.safeParse === "function";
}

// disk path (relative to routesDir) -> URL path. `index` collapses, `[id]` -> `{id}`.
// An optional trailing `.<method>` (e.g. `index.post.ts`, `[id].delete.ts`) is
// stripped, so several files can share one path with different HTTP methods —
// the method still comes from each file's defineRoute. This is the only way to
// put GET-list and POST-create on the same REST path under file-based routing.
function derivePath(rel: string, base: string): string {
  let p = rel
    .replace(/\.ts$/, "")
    .replace(/\.(get|post|put|patch|delete|options)$/i, "")
    .replace(/\/index$/, "")
    .replace(/^index$/, "");
  p = p.replaceAll("[", "{").replaceAll("]", "}");
  const full = `${base}/${p}`.replace(/\/+/g, "/").replace(/\/$/, "");
  return full || base;
}

const sortStaticFirst = (a: string, b: string) => {
  const ap = a.includes("["), bp = b.includes("[");
  return ap === bp ? 0 : ap ? 1 : -1;
};

async function collect(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir)) {
    const fp = path.join(dir, entry);
    const st = await stat(fp);
    if (st.isDirectory()) {
      out.push(...(await collect(fp)).map((sub) => path.join(entry, sub)));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      out.push(entry);
    }
  }
  return out;
}
