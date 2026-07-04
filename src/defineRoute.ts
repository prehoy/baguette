import type { z } from "@hono/zod-openapi";
import type { Context } from "hono";

export type Method = "get" | "post" | "put" | "delete" | "patch" | "options";

const BAGUETTE = Symbol.for("baguette.route");

type Obj = z.ZodObject<any>;

export interface RouteConfig<
  P extends Obj | undefined,
  Q extends Obj | undefined,
  B extends z.ZodType | undefined,
> {
  method: Method;
  summary?: string;
  tags?: string[];
  request?: { params?: P; query?: Q; body?: B };
  /** A single zod schema (200) or a `{ status: schema }` map. */
  response?: z.ZodType | Record<number, z.ZodType>;
  handler: (
    c: Context,
    input: {
      params: P extends Obj ? z.infer<P> : undefined;
      query: Q extends Obj ? z.infer<Q> : undefined;
      body: B extends z.ZodType ? z.infer<B> : undefined;
    },
  ) => Response | Promise<Response>;
}

export type RouteDescriptor = RouteConfig<any, any, any> & {
  [BAGUETTE]: true;
};

/**
 * The single source of truth for a route. One zod declaration yields runtime
 * validation, inferred handler types, the OpenAPI spec, and the error funnel.
 * The path is derived from the file's location by the loader — not declared here.
 */
export function defineRoute<
  P extends Obj | undefined = undefined,
  Q extends Obj | undefined = undefined,
  B extends z.ZodType | undefined = undefined,
>(config: RouteConfig<P, Q, B>): RouteDescriptor {
  return { ...config, [BAGUETTE]: true } as RouteDescriptor;
}

export function isBaguetteRoute(x: any): x is RouteDescriptor {
  return !!x && x[BAGUETTE] === true;
}
