import type { Context } from "hono";
import logger from "./logger";
import stringifyError from "./stringifyError";

export default function routeError(props: {
  name: string;
  e: unknown;
  context: Context;
}) {
  const processId = props.context.get("process_id");
  // Full detail goes to the logs (correlate via process_id); the client gets a
  // generic message only. Never echo e.message / upstream response bodies back —
  // they leak schema/column names and third-party payloads (recon surface).
  logger.error({
    message: `Error in route: ${props.name}`,
    error: stringifyError(props.e),
    process_id: processId,
  });
  return props.context.json({ error: "Internal server error", process_id: processId }, 500);
}
