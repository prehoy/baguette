import { defineRoute, z } from "../../src/index";

// Body is validated + typed from the schema; invalid input -> 400 automatically.
export default defineRoute({
  method: "post",
  summary: "Double a number",
  tags: ["Demo"],
  request: { body: z.object({ count: z.number() }) },
  response: z.object({ doubled: z.number() }),
  handler: (c, { body }) => c.json({ doubled: body.count * 2 }),
});
