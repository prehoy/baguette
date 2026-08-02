import { defineRoute, z } from "../../src/index";

// Single-file multipart upload. `contentType` flips body validation to form
// parsing, so the z.file() field receives the uploaded File. z.coerce.number()
// turns the form's string field into a number.
export default defineRoute({
  method: "post",
  summary: "Upload a file for a project",
  tags: ["Demo"],
  request: {
    contentType: "multipart/form-data",
    body: z.object({
      projectId: z.coerce.number(),
      file: z.file(),
    }),
  },
  response: z.object({ projectId: z.number(), name: z.string(), size: z.number() }),
  handler: (c, { body }) =>
    c.json({ projectId: body.projectId, name: body.file.name, size: body.file.size }),
});
