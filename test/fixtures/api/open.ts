import { defineRoute } from "../../../src/index";

export default defineRoute({
  method: "get",
  middleware: [
    async (c, next) => {
      await next();
      c.header("x-mw", "ran");
    },
  ],
  handler: (c) => c.json({ ok: true }),
});
