import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderEmail, sendEmail, type EmailTransport } from "../src/email";
import Welcome, { preview } from "../examples/emails/Welcome";
import { createApp } from "../src/index";

test("renderEmail turns a React template into HTML", async () => {
  const html = await renderEmail(createElement(Welcome, { name: "Ada" }));
  expect(html).toContain("Ada");
  expect(html).toContain("Thanks for trying baguette");
  expect(html).toContain("<html");
});

test("sendEmail renders react + routes to the transport; no recipient is a no-op", async () => {
  const sent: any[] = [];
  const transport: EmailTransport = async (m) => void sent.push(m);

  await sendEmail(
    { to: "a@b.com", from: "no-reply@x.com", subject: "Hi", react: createElement(Welcome, preview) },
    transport,
  );
  expect(sent).toHaveLength(1);
  expect(sent[0].to).toEqual(["a@b.com"]);
  expect(sent[0].html).toContain("Ada");
  expect(sent[0].text).toContain("Thanks for trying baguette"); // plain-text alt auto-generated

  await sendEmail({ to: ["", "  "], from: "x@y.com", subject: "Hi", html: "<p>hi</p>" }, transport);
  expect(sent).toHaveLength(1); // still 1 — empty recipients dropped, no send
});

test("emails:true mounts the preview endpoint (list + render)", async () => {
  const app = await createApp({
    routesDir: `${import.meta.dir}/fixtures/api`,
    auth: () => ({ id: "u" }),
    emails: { dir: `${import.meta.dir}/../examples/emails` },
    logRequests: false,
    docs: false,
  });

  const list = (await (await app.request("/api/emails")).json()) as { templates: string[] };
  expect(list.templates).toContain("Welcome");

  const res = await app.request("/api/emails/Welcome");
  expect(res.status).toBe(200);
  expect(await res.text()).toContain("Ada");
});
