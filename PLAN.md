# Baguette — Build Plan

**Blazingly fast, zero-config Bun + Hono API framework.** Drop a file, get a
typed, documented, validated endpoint. AI-proof by convention.

Extracted from the shared plumbing of text-apps-api, lawbot-api, hcm-cloud, and
sim-api-bun (~400 LOC of copy-pasted framework glue that had drifted across
four repos). Goal: one package, all four converge on it.

## Positioning
Blazingly fast · zero-config · type-safe end to end · **the framework your AI
can't make a mess of**. No competitor comparisons in marketing.

## Layers (each independently optional)
1. **HTTP core** — `serve()` + `defineRoute()` + primitives. ORM-agnostic. Required.
2. **Cron** — `startCron()`, Postgres advisory lock, file-based `cron/*.ts`. Optional.
3. **Automations** — `startAutomations()`, Postgres LISTEN/NOTIFY, file-based `automations/*.ts`. Optional.

`serve()` auto-wires cron/automations by convention (dir exists → on; automations also gated by `AUTOMATIONS=true`). No dir → code never imported.

## Design decisions (locked)
- **zod4 is the single source of truth.** `defineRoute` → validation + inferred types + OpenAPI + error funnel from one declaration. `z`/`createRoute` re-exported from baguette so apps share the exact zod version.
- **ORM-agnostic.** Framework imports no ORM. Cron/automations touch Postgres only via raw SQL (advisory locks, LISTEN/NOTIFY, trigger DDL).
- **Dropped `typeconv` + Prisma-JSON-schema boot step** — zod owns schemas now.
- **4 perf fixes baked in:** (1) no parse-everything middleware — body parsed lazily via schema; (2) basic request logging, never stringifies body; (3) no ORM in the hot path; (4) parallel route import at boot + `reusePort`.
- **AI-clean-code moat, first-class from v0:** shipped `AGENTS.md` contract, `baguette/eslint` preset, `baguette check`, and `baguette new` scaffolding.

## Milestones
- [x] **0** — Repo init (package.json, tsconfig, PLAN.md, AGENTS.md, README)
- [x] **1** — HTTP core: `defineRoute` + `loadRoutes` + `createApp`/`serve` + primitives + 4 perf fixes + smoke test
- [ ] **2** — Example app (expand `examples/`)
- [ ] **3** — CLI: `baguette new` (route/cron/automation) + `baguette check`
- [ ] **4** — `baguette/eslint` preset wired to the contract
- [ ] **5** — Cron: `startCron` + advisory lock, convention auto-wire
- [ ] **6** — Automations: `startAutomations` + LISTEN/NOTIFY + trigger DDL
- [ ] **7** — Migrate hcm-cloud onto baguette (first real consumer)
- [ ] **8** — Landing + docs → usebaguette.com (Qwik City + MDX, forked from prehoy base)

Milestone 8 depends only on M1; parallelizable with 3–7.

## Route contract
```ts
export default defineRoute({
  method: "post",
  request: { params: z.object({ id: z.string() }),
             body: z.object({ items: z.array(ItemSchema) }) },
  response: OrderSchema,                       // zod (single = 200) or { 200: s, 404: s }
  handler: async (c, { params, body }) => c.json(await create(params.id, body)),
});
// path derived from file location; params/query/body validated + typed; 500 funnel automatic.
```
