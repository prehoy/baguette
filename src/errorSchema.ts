import { z } from "@hono/zod-openapi";

// The shape routeError returns on any uncaught error. Attached as the 500
// response to every defineRoute so it shows up in the OpenAPI docs.
export const ErrorSchema = z
  .object({
    error: z.string(),
    // Correlate with the server logs; no internal detail is returned to clients.
    process_id: z.string().optional(),
  })
  .openapi("Error");
