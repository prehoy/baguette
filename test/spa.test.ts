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
