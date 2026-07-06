# 🥖 baguette

**The Bun + Hono API framework your AI agent can't make a mess of.**

Generated backend code rots because there are a hundred ways to do everything.
baguette ships **one** — file-based routes, zod-first I/O, batteries included — and
enforces it with a checker your AI can't merge around. Blazingly fast, zero-config,
typed end to end.

[Docs](https://usebaguette.com) · [npm](https://www.npmjs.com/package/@prehoy/baguette) · [llms.txt](https://usebaguette.com/llms.txt)

## Quickstart

```bash
bun create baguette my-api
cd my-api && bun run dev     # → http://localhost:3000 · docs at /api/docs
```

Add an endpoint — the file's location is the URL, and one declaration gives you
validation, inferred types, OpenAPI docs, and an error funnel:

```ts
// api/customers/[id].ts  →  GET /api/customers/{id}
import { defineRoute, z } from "@prehoy/baguette";

export default defineRoute({
  method: "get",
  request: { params: z.object({ id: z.string() }) },
  response: z.object({ id: z.string(), name: z.string() }),
  handler: (c, { params }) => c.json({ id: params.id, name: "Ada" }),
});
```

```ts
// server.ts
import { serve } from "@prehoy/baguette";
serve({ routesDir: "./api" });   // routes loaded, docs live, done
```

## Built for AI agents

The thing that makes generated code a mess — infinite ways to structure it — is the
thing baguette removes. Every app on baguette is the same shape, so an agent (or a
new hire) can't drift:

- **One obvious way** — one route per file, all I/O through zod, no manual parsing.
- **A shipped [clean-code contract](./AGENTS.md)** every repo inherits — read by humans *and* the AI tools working in it.
- **`baguette/eslint` + `baguette check`** turn the conventions into CI failures, so an agent physically can't merge the mess.
- **[llms.txt](https://usebaguette.com/llms.txt)** — the whole framework, machine-readable, so agents get it right the first time.

## Batteries included — each opt-in

| | |
|---|---|
| **Routing** | File-based, `[id]` params, method-suffixed files, auto Scalar docs |
| **Validation** | zod-first: one schema → validation + types + OpenAPI |
| **Security** | Declarative per-route `auth`, rate limiting, security headers, CORS guard, body limits |
| **Real-time** | Opt-in WebSockets with a room/channel pub/sub |
| **Background** | `cron/` (memory/Postgres/Redis/SQLite locks), `queues/` (bee-queue), `automations/` (LISTEN/NOTIFY) |
| **Email** | React templates, browser preview, send via Resend/SMTP |
| **Ops** | `onBoot`/`onShutdown` + graceful SIGTERM, static/SPA serving, typed `defineEnv` |
| **Agnostic** | No ORM in the core — Prisma, Drizzle, or raw SQL |

Full docs: **[usebaguette.com/docs](https://usebaguette.com/docs)**

## Deploy

`bun create baguette` ships a Dockerfile — run it anywhere, or have it **managed on
[Berth](https://useberth.com)**. Building something bigger? [Talk to Prehoy](https://prehoy.com)
— we do the infra and the backend.

## Contributing / dev

```bash
bun install
bun test
bun run dev      # runs examples/ on :3000
```

MIT · a [Prehoy Industries](https://prehoy.com) project · [usebaguette.com](https://usebaguette.com)
