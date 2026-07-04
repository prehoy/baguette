import { defineRoute, z } from "../../../../src/index";

// POST /api/widgets — create. Same path as index.get.ts, different method.
export default defineRoute({
  method: "post",
  request: { body: z.object({ name: z.string() }) },
  handler: (c, { body }) => c.json({ created: body.name }, 201),
});
