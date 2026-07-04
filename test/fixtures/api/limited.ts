import { defineRoute } from "../../../src/index";

// 2 requests per minute per IP, then 429. Runs before auth.
export default defineRoute({
  method: "get",
  rateLimit: { limit: 2, window: "1m" },
  handler: (c) => c.json({ ok: true }),
});
