import { expect, test } from "bun:test";
import { createApp, memoryStore, parseWindow, rateLimit } from "../src/index";
import { Hono } from "hono";

const FIX = `${import.meta.dir}/fixtures/api`;

test("parseWindow accepts seconds and unit strings", () => {
  expect(parseWindow(30)).toBe(30);
  expect(parseWindow("1m")).toBe(60);
  expect(parseWindow("15m")).toBe(900);
  expect(parseWindow("1h")).toBe(3600);
  expect(() => parseWindow("nope")).toThrow();
});

test("memoryStore counts per key within the window", async () => {
  const s = memoryStore();
  expect((await s.hit("a", 60)).count).toBe(1);
  expect((await s.hit("a", 60)).count).toBe(2);
  expect((await s.hit("b", 60)).count).toBe(1); // independent key
});

test("rateLimit middleware allows up to the limit then 429s with Retry-After", async () => {
  const app = new Hono();
  app.use("*", rateLimit({ limit: 2, window: "1m" }, memoryStore()));
  app.get("/", (c) => c.json({ ok: true }));

  expect((await app.request("/")).status).toBe(200);
  const second = await app.request("/");
  expect(second.status).toBe(200);
  expect(second.headers.get("x-ratelimit-remaining")).toBe("0");

  const third = await app.request("/");
  expect(third.status).toBe(429);
  expect(third.headers.get("retry-after")).toBeTruthy();
});

test("per-route rateLimit option enforces the limit (fresh injected store)", async () => {
  const app = await createApp({
    routesDir: FIX,
    auth: () => null,
    rateLimitStore: memoryStore(), // fresh store, isolated from other tests
    logRequests: false,
    docs: false,
  });
  expect((await app.request("/api/limited")).status).toBe(200);
  expect((await app.request("/api/limited")).status).toBe(200);
  expect((await app.request("/api/limited")).status).toBe(429);
});

test("custom key buckets independently (e.g. by email, not IP)", async () => {
  const app = new Hono();
  app.use("*", rateLimit({ limit: 1, window: "1m", key: (c) => c.req.query("u") ?? "x" }, memoryStore()));
  app.get("/", (c) => c.json({ ok: true }));
  expect((await app.request("/?u=alice")).status).toBe(200);
  expect((await app.request("/?u=alice")).status).toBe(429); // alice over limit
  expect((await app.request("/?u=bob")).status).toBe(200); // bob independent
});
