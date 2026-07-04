import { defineRoute, z } from "../../src/index";

export default defineRoute({
  method: "get",
  summary: "Say hello",
  tags: ["Demo"],
  request: { query: z.object({ name: z.string().default("world") }) },
  response: z.object({ greeting: z.string() }),
  handler: (c, { query }) => c.json({ greeting: `Hello, ${query.name}!` }),
});
