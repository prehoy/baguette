import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createRoute, type OpenAPIHono, type z } from "@hono/zod-openapi";
import { isBaguetteRoute, type RouteDescriptor } from "./defineRoute";
import { ErrorSchema } from "./errorSchema";
import routeHandler from "./routeHandler";
import logger from "./logger";

/**
 * File-based router. Scans `routesDir` recursively; each file's location becomes
 * its URL path (`[id]` folders/files -> `{id}`). Imports run in parallel (fast
 * cold start); mounting stays sequential (stable order, static before params).
 */
export async function loadRoutes(
  app: OpenAPIHono,
  opts: { routesDir: string; basePath?: string },
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
      mountRoute(app, routePath, def);
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

function mountRoute(app: OpenAPIHono, routePath: string, def: RouteDescriptor) {
  const route = createRoute({
    method: def.method,
    path: routePath,
    summary: def.summary,
    tags: def.tags,
    request: buildRequest(def.request),
    responses: buildResponses(def.response),
  });
  // Cast at the framework boundary so app code never needs one: zod-openapi's
  // handler return type can't see through our routeHandler wrapper.
  app.openapi(route, (async (c: any) => {
    const input = {
      params: def.request?.params ? c.req.valid("param") : undefined,
      query: def.request?.query ? c.req.valid("query") : undefined,
      body: def.request?.body ? c.req.valid("json") : undefined,
    };
    return routeHandler({ name: routePath, c, handler: () => def.handler(c, input) });
  }) as any);
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
function derivePath(rel: string, base: string): string {
  let p = rel.replace(/\.ts$/, "").replace(/\/index$/, "").replace(/^index$/, "");
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
