import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../src/index";

const dir = mkdtempSync(path.join(tmpdir(), "baguette-spa-"));
writeFileSync(path.join(dir, "index.html"), "<!doctype html><div id=app>SPA</div>");
writeFileSync(path.join(dir, "app.js"), 'console.log("asset")');

const app = await createApp({
  routesDir: `${import.meta.dir}/../examples/api`,
  spa: dir,
  logRequests: false,
  docs: false,
});

test("API routes win over the SPA", async () => {
  const r = await app.request("/api/hello?name=X");
  expect(await r.json()).toEqual({ greeting: "Hello, X!" });
});

test("real static assets are served", async () => {
  const r = await app.request("/app.js");
  expect(r.status).toBe(200);
  expect(await r.text()).toContain("asset");
});

test("SPA deep links fall back to index.html", async () => {
  const r = await app.request("/download"); // no such file — client-side route
  expect(r.status).toBe(200);
  expect(await r.text()).toContain("id=app");
});

test("unknown /api/* still 404s (not the SPA html)", async () => {
  const r = await app.request("/api/does-not-exist");
  expect(r.status).toBe(404);
  expect(await r.text()).not.toContain("id=app");
});

// --- array form: one SPA per host, hostless entry is the fallback ---

const adminDir = mkdtempSync(path.join(tmpdir(), "baguette-spa-admin-"));
writeFileSync(path.join(adminDir, "index.html"), "<!doctype html><div id=admin>ADMIN</div>");
writeFileSync(path.join(adminDir, "admin.js"), 'console.log("admin asset")');

// Deliberately fallback-first: the sort must move the host-scoped entry ahead,
// or the fallback shadows admin.example.com entirely.
const multi = await createApp({
  routesDir: `${import.meta.dir}/../examples/api`,
  spa: [{ dir }, { dir: adminDir, host: "admin.example.com" }],
  logRequests: false,
  docs: false,
});

const get = (p: string, host?: string) =>
  multi.request(p, host ? { headers: { host } } : undefined);

test("host-scoped SPA wins for its host", async () => {
  const r = await get("/dashboard", "admin.example.com");
  expect(await r.text()).toContain("id=admin");
});

test("other hosts get the hostless fallback SPA", async () => {
  const r = await get("/dashboard", "www.example.com");
  expect(await r.text()).toContain("id=app");
});

test("host match ignores the port in the Host header", async () => {
  const r = await get("/dashboard", "admin.example.com:3000");
  expect(await r.text()).toContain("id=admin");
});

test("assets resolve per host, with a real content-type", async () => {
  const r = await get("/admin.js", "admin.example.com");
  expect(r.status).toBe(200);
  expect(await r.text()).toContain("admin asset");
  // The whole point of staying on serveStatic: no hand-rolled MIME map needed.
  expect(r.headers.get("content-type")).toContain("javascript");
});

test("host-scoped SPA does not leak its assets to other hosts", async () => {
  const r = await get("/admin.js", "www.example.com");
  expect(await r.text()).not.toContain("admin asset"); // falls back to index.html
});

test("API still wins over every SPA in the array", async () => {
  const r = await get("/api/hello?name=X", "admin.example.com");
  expect(await r.json()).toEqual({ greeting: "Hello, X!" });
});
