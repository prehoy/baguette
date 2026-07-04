import { defineRoute, z } from "../../../src/index";

// File location `customers/[id].ts` -> path `/api/customers/{id}`.
export default defineRoute({
  method: "get",
  summary: "Get a customer",
  tags: ["Customers"],
  request: { params: z.object({ id: z.string() }) },
  response: z.object({ id: z.string(), name: z.string() }),
  handler: (c, { params }) => c.json({ id: params.id, name: "Ada" }),
});
