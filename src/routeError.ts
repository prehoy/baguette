import type { Context } from "hono";
import logger from "./logger";
import processError from "./processError";
import stringifyError from "./stringifyError";

export default function routeError(props: {
  name: string;
  e: unknown;
  context: Context;
}) {
  logger.error({
    message: `Error in route: ${props.name}`,
    error: stringifyError(props.e),
    process_id: props.context.get("process_id"),
  });
  return props.context.json(
    {
      error: `Internal server error on route ${props.name}`,
      message: processError(props.e),
    },
    500,
  );
}
