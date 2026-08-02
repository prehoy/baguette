import { defineRoute, z } from "../../src/index";

// Multi-file upload. z.array(z.file()) accepts several files posted under one
// field name — the client repeats the `files` field per file (a generated client
// from `type: array` does this). Note: exactly one file must still be sent as an
// array field (repeat the key or name it `files[]`), else it arrives as a scalar.
export default defineRoute({
  method: "post",
  summary: "Upload multiple files for a project",
  tags: ["Demo"],
  request: {
    contentType: "multipart/form-data",
    body: z.object({
      projectId: z.coerce.number(),
      files: z.array(z.file()),
    }),
  },
  response: z.object({
    projectId: z.number(),
    files: z.array(z.object({ name: z.string(), size: z.number() })),
  }),
  handler: (c, { body }) =>
    c.json({
      projectId: body.projectId,
      files: body.files.map((f) => ({ name: f.name, size: f.size })),
    }),
});
