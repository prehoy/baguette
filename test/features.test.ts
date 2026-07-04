import { expect, test } from "bun:test";
import { createApp, defineEnv, z } from "../src/index";

const FIX = `${import.meta.dir}/fixtures/api`;

// --- #3 per-route auth + middleware ---

test("auth:true returns 401 when the resolver yields no user", async () => {
  const app = await createApp({ routesDir: FIX, auth: () => null, logRequests: false, docs: false });
  const res = await app.request("/api/me");
  expect(res.status).toBe(401);
});

test("auth:true sets c.get('user') when the resolver yields one", async () => {
  const app = await createApp({
    routesDir: FIX,
    auth: () => ({ id: "u1" }) as never,
    logRequests: false,
    docs: false,
  });
  const res = await app.request("/api/me", { headers: { authorization: "Bearer x" } });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ user: { id: "u1" } });
});

test("route middleware runs", async () => {
  const app = await createApp({ routesDir: FIX, auth: () => null, logRequests: false, docs: false });
  const res = await app.request("/api/open");
  expect(res.headers.get("x-mw")).toBe("ran");
});

test("auth:true without a resolver fails loudly at boot", async () => {
  await expect(createApp({ routesDir: FIX, logRequests: false, docs: false })).rejects.toThrow(/auth resolver/);
});

// --- #5 CORS footgun guard ---

test("credentials + wildcard origin is rejected", async () => {
  await expect(
    createApp({ routesDir: FIX, auth: () => null, cors: { origin: "*", credentials: true } }),
  ).rejects.toThrow(/credentials/i);
});

test("reflect + credentials is allowed and echoes the Origin", async () => {
  const app = await createApp({
    routesDir: FIX,
    auth: () => null,
    cors: { reflect: true, credentials: true },
    logRequests: false,
    docs: false,
  });
  const res = await app.request("/api/open", { headers: { origin: "https://app.example.com" } });
  expect(res.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
  expect(res.headers.get("access-control-allow-credentials")).toBe("true");
});

// --- #4 security headers ---

test("securityHeaders adds nosniff + frame options", async () => {
  const app = await createApp({
    routesDir: FIX,
    auth: () => null,
    securityHeaders: true,
    logRequests: false,
    docs: false,
  });
  const res = await app.request("/api/open");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("x-frame-options")).toBeTruthy();
});

// --- #10 typed env ---

test("defineEnv coerces + defaults, and throws listing invalid vars", () => {
  Bun.env.BAG_TEST_NUM = "42";
  const env = defineEnv(
    z.object({ BAG_TEST_NUM: z.coerce.number(), BAG_TEST_OPT: z.string().default("x") }),
  );
  expect(env.BAG_TEST_NUM).toBe(42);
  expect(env.BAG_TEST_OPT).toBe("x");

  expect(() => defineEnv(z.object({ BAG_DEFINITELY_MISSING: z.string() }))).toThrow(/environment/i);
});
