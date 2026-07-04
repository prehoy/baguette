import { defineRoute } from "../../../src/index";

// auth:true -> the configured resolver runs; 401 if it returns falsy.
export default defineRoute({
  method: "get",
  auth: true,
  handler: (c) => c.json({ user: c.get("user") }),
});
