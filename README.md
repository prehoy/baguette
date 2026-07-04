# 🥖 baguette

**Blazingly fast, zero-config Bun + Hono API framework.** Drop a file, get a
typed, documented, validated endpoint.

```ts
// api/customers/[id].ts
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
serve({ routesDir: "./api" }); // routes loaded, docs at /api/docs
```

One zod declaration gives you runtime validation, inferred handler types, the
OpenAPI spec, and an error funnel. The path comes from the file's location.

## Why
- **zod-first** — one source of truth, no hand-wired OpenAPI, no manual parsing.
- **File-based routing** — `api/customers/[id].ts` → `/api/customers/{id}`.
- **Auto docs** — Scalar UI at `/api/docs`, spec at `/api/doc`.
- **ORM-agnostic** — bring Prisma, Drizzle, or raw SQL.
- **Optional cron & automations** — `cron/` and `automations/` dirs, opt-in.
- **AI-proof** — one-way conventions + a shipped [clean-code contract](./AGENTS.md) + a CI checker.

## Status
Early. HTTP core is working (`bun test`). See [PLAN.md](./PLAN.md).

## Dev
```
bun install
bun test
bun run dev      # runs examples/ on :3000
```
