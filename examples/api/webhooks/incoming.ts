import type { Context } from "hono";

// Raw escape hatch: a third-party webhook that must accept ANY payload (so no
// zod schema). This is the one blessed exception to the "all I/O through zod"
// rule — the loader mounts a plain default-exported handler with app.all.
export default async function incomingWebhook(c: Context) {
  const body = await c.req.json().catch(() => null);
  console.log("webhook received", body); // ponytail: demo only; real apps use logger
  return c.json({ received: true });
}
