# {{name}}

A [baguette](https://usebaguette.com) API — Bun + Hono, typed and documented by convention.

```bash
bun install
bun run dev        # http://localhost:3000  ·  interactive docs at /api/docs
```

## Add an endpoint

Drop a file in `api/`. Its location is the URL; one `defineRoute` gives you
validation, inferred types, OpenAPI docs, and an error funnel:

```ts
// api/orders/[id].ts  →  GET /api/orders/{id}
import { defineRoute, z } from "@prehoy/baguette";

export default defineRoute({
  method: "get",
  request: { params: z.object({ id: z.string() }) },
  response: z.object({ id: z.string(), total: z.number() }),
  handler: (c, { params }) => c.json({ id: params.id, total: 42 }),
});
```

## What's next

- **Auth, rate limiting, security headers, CORS** — one flag each.
- **WebSockets, cron, queues, email** — opt-in layers, drop a folder.
- Full docs: **https://usebaguette.com/docs**

## Deploy

`docker build` and run anywhere, or have it **managed on [Berth](https://useberth.com)**.
Need it built for you? [Talk to Prehoy](https://prehoy.com).
