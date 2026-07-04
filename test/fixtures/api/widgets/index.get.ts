import { defineRoute } from "../../../../src/index";

// GET /api/widgets — collection list. Shares its path with index.post.ts.
export default defineRoute({
  method: "get",
  handler: (c) => c.json({ list: ["a", "b"] }),
});
