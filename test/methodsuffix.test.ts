import { expect, test } from "bun:test";
import { createApp } from "../src/index";

// Method-suffixed files (`index.get.ts`, `index.post.ts`, `[id].delete.ts`) let
// several files share one path with different HTTP methods — the REST-collection
// case (GET list + POST create on /api/widgets).
const app = await createApp({
  routesDir: `${import.meta.dir}/fixtures/api`,
  auth: () => ({ id: "u" }),
  logRequests: false,
});

test("GET and POST coexist on the same collection path", async () => {
  expect(await (await app.request("/api/widgets")).json()).toEqual({ list: ["a", "b"] });

  const created = await app.request("/api/widgets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "x" }),
  });
  expect(created.status).toBe(201);
  expect(await created.json()).toEqual({ created: "x" });
});

test("method-suffixed param file maps to /{id}", async () => {
  const res = await app.request("/api/widgets/42", { method: "DELETE" });
  expect(await res.json()).toEqual({ deleted: "42" });
});
