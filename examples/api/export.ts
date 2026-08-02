import { defineRoute, z } from "../../src/index";

// Binary download: `response: z.file()` documents an application/octet-stream body
// (format: binary) so a generated client returns a Blob. The handler sets the real
// Content-Type + filename at runtime — here a tiny fake DOCX.
export default defineRoute({
  method: "get",
  summary: "Export a project as DOCX",
  tags: ["Demo"],
  response: z.file(),
  handler: (c) => {
    const bytes = new TextEncoder().encode("PK fake-docx");
    return c.body(bytes, 200, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="export.docx"',
    });
  },
});
