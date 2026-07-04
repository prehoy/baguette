import { expect, test } from "bun:test";
import { createApp } from "../src/index";

const app = await createApp({
  routesDir: `${import.meta.dir}/../examples/api`,
  logRequests: false,
});

test("typed query route responds + applies defaults", async () => {
  expect(await (await app.request("/api/hello?name=Bob")).json()).toEqual({
    greeting: "Hello, Bob!",
  });
  expect(await (await app.request("/api/hello")).json()).toEqual({
    greeting: "Hello, world!",
  });
});

test("path params resolve from file location", async () => {
  expect(await (await app.request("/api/customers/42")).json()).toEqual({
    id: "42",
    name: "Ada",
  });
});

test("body is validated + typed; valid input works", async () => {
  const res = await app.request("/api/echo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ count: 21 }),
  });
  expect(await res.json()).toEqual({ doubled: 42 });
});

test("invalid body -> 400 (no handler code runs)", async () => {
  const res = await app.request("/api/echo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ count: "nope" }),
  });
  expect(res.status).toBe(400);
});

test("unknown route -> 404", async () => {
  expect((await app.request("/api/nope")).status).toBe(404);
});

test("OpenAPI spec is generated", async () => {
  const spec = (await (await app.request("/api/doc")).json()) as any;
  expect(spec.openapi).toBe("3.1.0");
  expect(spec.paths["/api/hello"]).toBeDefined();
});
