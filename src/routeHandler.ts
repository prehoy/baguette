import type { Context } from "hono";
import logger from "./logger";
import routeError from "./routeError";

// Wraps every handler: timing + one funnel for uncaught errors -> structured 500.
export default async function routeHandler(props: {
  name: string;
  c: Context;
  handler: () => unknown;
}) {
  const start = Date.now();
  try {
    const r = await props.handler();
    logger.info({
      message: `Route ${props.name} took ${Date.now() - start}ms`,
      process_id: props.c.get("process_id"),
    });
    return r;
  } catch (e) {
    return routeError({ name: props.name, e, context: props.c });
  }
}
