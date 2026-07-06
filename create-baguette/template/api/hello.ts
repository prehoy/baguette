import { defineRoute, z } from "@prehoy/baguette";

// One zod declaration → validation, inferred types, OpenAPI docs, error funnel.
export default defineRoute({
  method: "get",
  summary: "Say hello",
  request: { query: z.object({ name: z.string().default("world") }) },
  response: z.object({ greeting: z.string() }),
  handler: (c, { query }) => c.json({ greeting: `Hello, ${query.name}!` }),
});
