import { defineRoute, z } from "../../../../src/index";

// DELETE /api/widgets/{id} — method-suffixed param file.
export default defineRoute({
  method: "delete",
  request: { params: z.object({ id: z.string() }) },
  handler: (c, { params }) => c.json({ deleted: params.id }),
});
