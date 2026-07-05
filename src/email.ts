import type { ReactElement } from "react";
import type { Context } from "hono";
import { Glob } from "bun";
import path from "node:path";
import { defineQueue } from "./queue";

/*
 * Opt-in email: React templates -> email-safe HTML, a preview endpoint, and send.
 * Reachable only via `@prehoy/baguette/email`, never from the HTTP core. React,
 * @react-email/render and nodemailer are OPTIONAL peer deps, loaded lazily below —
 * so this module imports cleanly even if they're absent; you only hit the error
 * when you actually render or send.
 */

async function loadRender() {
  try {
    return (await import("@react-email/render")).render;
  } catch {
    throw new Error("Email rendering needs @react-email/render — `bun add @react-email/render react`");
  }
}

/** Render a React email element to email-safe HTML (or plain text). */
export async function renderEmail(
  element: ReactElement,
  opts?: { plainText?: boolean },
): Promise<string> {
  const render = await loadRender();
  return render(element, { pretty: false, plainText: opts?.plainText });
}

export interface EmailMessage {
  to: string | string[];
  from?: string; // defaults to EMAIL_FROM
  subject: string;
  /** A React email element — rendered to HTML (+ text). Or pass `html` directly. */
  react?: ReactElement;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: { filename: string; content?: string | Buffer; path?: string }[];
}

export type EmailTransport = (msg: {
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: EmailMessage["attachments"];
}) => Promise<void>;

const arr = (v?: string | string[]) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** Render (if `react`) and send via `transport` (default: from env). No-ops with no recipient. */
export async function sendEmail(msg: EmailMessage, transport?: EmailTransport): Promise<void> {
  const html = msg.html ?? (msg.react ? await renderEmail(msg.react) : undefined);
  const text =
    msg.text ?? (msg.react && !msg.html ? await renderEmail(msg.react, { plainText: true }) : undefined);
  const from = msg.from ?? Bun.env.EMAIL_FROM;
  if (!from) throw new Error("sendEmail: no `from` and EMAIL_FROM is unset");
  const to = arr(msg.to).map((s) => s.trim()).filter(Boolean);
  if (!to.length) return; // dropped every recipient -> nothing to send
  const send = transport ?? (await transportFromEnv());
  await send({
    from,
    to,
    subject: msg.subject,
    html,
    text,
    cc: arr(msg.cc),
    bcc: arr(msg.bcc),
    replyTo: msg.replyTo,
    attachments: msg.attachments,
  });
}

/**
 * Transport from env:
 *   RESEND_API_KEY               -> Resend
 *   SMTP_URL                     -> nodemailer (connection string)
 *   SMTP_HOST/PORT/USER/PASS     -> nodemailer
 */
export async function transportFromEnv(): Promise<EmailTransport> {
  if (Bun.env.RESEND_API_KEY) return resendTransport(Bun.env.RESEND_API_KEY);
  if (Bun.env.SMTP_URL || Bun.env.SMTP_HOST) return smtpTransport();
  throw new Error(
    "No email transport configured — set RESEND_API_KEY, SMTP_URL, or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS.",
  );
}

export function smtpTransport(): EmailTransport {
  let tp: any;
  return async (m) => {
    if (!tp) {
      let nodemailer: any;
      try {
        nodemailer = (await import("nodemailer")).default;
      } catch {
        throw new Error("SMTP transport needs nodemailer — `bun add nodemailer`");
      }
      tp = Bun.env.SMTP_URL
        ? nodemailer.createTransport(Bun.env.SMTP_URL)
        : nodemailer.createTransport({
            host: Bun.env.SMTP_HOST,
            port: Number(Bun.env.SMTP_PORT ?? 587),
            secure: Bun.env.SMTP_SECURE === "true",
            auth: Bun.env.SMTP_USER ? { user: Bun.env.SMTP_USER, pass: Bun.env.SMTP_PASS } : undefined,
          });
    }
    await tp.sendMail({
      from: m.from,
      to: m.to,
      cc: m.cc?.length ? m.cc : undefined,
      bcc: m.bcc?.length ? m.bcc : undefined,
      replyTo: m.replyTo,
      subject: m.subject,
      html: m.html,
      text: m.text,
      attachments: m.attachments,
    });
  };
}

export function resendTransport(apiKey: string): EmailTransport {
  return async (m) => {
    let Resend: any;
    try {
      Resend = (await import("resend")).Resend;
    } catch {
      throw new Error("Resend transport needs the `resend` package — `bun add resend`");
    }
    const { error } = await new Resend(apiKey).emails.send({
      from: m.from,
      to: m.to,
      cc: m.cc?.length ? m.cc : undefined,
      bcc: m.bcc?.length ? m.bcc : undefined,
      replyTo: m.replyTo,
      subject: m.subject,
      html: m.html,
      text: m.text,
      attachments: m.attachments?.map((a) => ({ filename: a.filename, content: a.content, path: a.path })),
    });
    if (error) throw new Error(`Resend: ${(error as any).message ?? JSON.stringify(error)}`);
  };
}

/** Serializable email payload (React must be pre-rendered to `html`/`text`). */
export type QueuedEmail = Omit<EmailMessage, "react">;

/**
 * Ready-made email queue (needs the queue layer + Redis). Run the worker by
 * re-exporting it as a queue file:
 *
 *   // queues/email.ts
 *   export { emailQueue as default } from "@prehoy/baguette/email";
 *
 * Then enqueue instead of sending inline:
 *   await emailQueue.add({ to, subject, html: await renderEmail(<Welcome name={n}/>) });
 */
export const emailQueue = defineQueue<QueuedEmail>({
  name: "baguette-email",
  concurrency: 5,
  retries: 3,
  process: async (data) => {
    await sendEmail(data);
  },
});

/**
 * Preview endpoint. `serve({ emails: true })` mounts it at /api/emails (list) and
 * /api/emails/:name (rendered HTML). Each template can `export const preview` with
 * sample props. Opt-in — gate it in production if you don't want it exposed.
 */
export function emailPreview(opts?: { dir?: string }) {
  const dir = path.resolve(opts?.dir ?? "./emails");
  return async (c: Context) => {
    const name = c.req.param("name");
    if (!name) {
      const names: string[] = [];
      for await (const rel of new Glob("**/*.tsx").scan({ cwd: dir })) {
        if (!/(^|\/)components\//.test(rel)) names.push(rel.replace(/\.tsx$/, ""));
      }
      return c.json({ templates: names.sort() });
    }
    let mod: any;
    try {
      mod = await import(path.join(dir, `${name}.tsx`));
    } catch {
      return c.json({ error: `Template "${name}" not found` }, 404);
    }
    if (typeof mod.default !== "function") {
      return c.json({ error: `Template "${name}" has no default component export` }, 400);
    }
    const { createElement } = await import("react");
    const html = await renderEmail(createElement(mod.default, mod.preview ?? {}));
    return c.html(html);
  };
}
