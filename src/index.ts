// zod + createRoute re-exported from @hono/zod-openapi so apps use the exact
// zod version baguette validates with (avoids dual-zod type mismatches).
export { z, createRoute, OpenAPIHono } from "@hono/zod-openapi";

export { defineRoute, isBaguetteRoute } from "./defineRoute";
export type {
  Method,
  RouteConfig,
  RouteDescriptor,
  AuthResolver,
  BaguetteUser,
} from "./defineRoute";
export { createApp } from "./createApp";
export type { AppOptions, CorsOption } from "./createApp";
export { default as serve } from "./serve";
export type { ServeOptions } from "./serve";
export { loadRoutes } from "./loadRoutes";
export { ErrorSchema } from "./errorSchema";
export { validateEnv, defineEnv } from "./env";
export { rateLimit, memoryStore, redisStore, clientIp, parseWindow } from "./rateLimit";
export type { RateLimitOptions, RateLimitStore } from "./rateLimit";

export { default as logger } from "./logger";
export { default as processError } from "./processError";
export { default as stringifyError } from "./stringifyError";
export { default as routeError } from "./routeError";
export { default as routeHandler } from "./routeHandler";
export { default as pubSubManager } from "./pubSubManager";
