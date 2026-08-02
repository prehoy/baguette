import { expect, test } from "bun:test";
import { createApp } from "../src/index";

const app = await createApp({
  routesDir: `${import.meta.dir}/../examples/api`,
  logRequests: false,
  docs: { specPath: "/api/doc" },
});

function form(fields: Record<string, string>, files: [name: string, file: File][]) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  for (const [k, f] of files) fd.append(k, f);
  return fd;
}

test("multipart upload validates + types the body", async () => {
  const fd = form({ projectId: "7" }, [
    ["file", new File(["hello"], "a.txt", { type: "text/plain" })],
  ]);
  const r = await app.request("/api/upload", { method: "POST", body: fd });
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({
    projectId: 7, // z.coerce.number turned the form string into a number
    name: "a.txt",
    size: 5,
  });
});

test("multiple files under one field become an array", async () => {
  const fd = form({ projectId: "9" }, [
    ["files", new File(["aa"], "a.txt")],
    ["files", new File(["bbbb"], "b.txt")],
  ]);
  const r = await app.request("/api/upload-batch", { method: "POST", body: fd });
  const body = (await r.json()) as { files: { name: string; size: number }[] };
  expect(body.files.map((f) => f.name)).toEqual(["a.txt", "b.txt"]);
  expect(body.files.map((f) => f.size)).toEqual([2, 4]);
});

test("missing file field -> 400 in the { error, issues } shape", async () => {
  const fd = form({ projectId: "7" }, []); // no file
  const r = await app.request("/api/upload", { method: "POST", body: fd });
  expect(r.status).toBe(400);
  const body = (await r.json()) as { error: string; issues: unknown[] };
  expect(body.error).toContain("file");
  expect(Array.isArray(body.issues)).toBe(true);
});

test("bad field type -> 400 (projectId not a number)", async () => {
  const fd = form({ projectId: "not-a-number" }, [["file", new File(["x"], "a.txt")]]);
  const r = await app.request("/api/upload", { method: "POST", body: fd });
  expect(r.status).toBe(400);
});

test("OpenAPI spec shows multipart with binary file field", async () => {
  const r = await app.request("/api/doc");
  const spec = (await r.json()) as any;
  const single = spec.paths["/api/upload"].post.requestBody.content["multipart/form-data"].schema;
  expect(single.properties.file.format).toBe("binary");
  const batch = spec.paths["/api/upload-batch"].post.requestBody.content["multipart/form-data"].schema;
  expect(batch.properties.files.type).toBe("array");
  expect(batch.properties.files.items.format).toBe("binary");
});

test("binary z.file() response -> octet-stream, format binary", async () => {
  const r = await app.request("/api/doc");
  const spec = (await r.json()) as any;
  const ok = spec.paths["/api/export"].get.responses["200"];
  const schema = ok.content["application/octet-stream"].schema;
  expect(schema.format).toBe("binary");
  expect(ok.content["application/json"]).toBeUndefined();
});

test("export handler streams real bytes with the docx Content-Type", async () => {
  const r = await app.request("/api/export");
  expect(r.status).toBe(200);
  expect(r.headers.get("content-type")).toContain("wordprocessingml.document");
  expect(await r.text()).toContain("fake-docx");
});

test("JSON routes still validate as JSON (backcompat)", async () => {
  const r = await app.request("/api/echo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ count: 21 }),
  });
  expect(await r.json()).toEqual({ doubled: 42 });
});
