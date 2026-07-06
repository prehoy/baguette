import { defineRoute, z } from "@prehoy/baguette";

// File location is the URL: api/customers/[id].ts → GET /api/customers/{id}
export default defineRoute({
  method: "get",
  summary: "Get a customer",
  request: { params: z.object({ id: z.string() }) },
  response: z.object({ id: z.string(), name: z.string() }),
  handler: (c, { params }) => c.json({ id: params.id, name: "Ada" }),
});
