# Baguette — Clean-Code Contract

Rules for any human or AI writing code in a baguette app. These are enforced by
`baguette/eslint` and `baguette check` — code that breaks them fails CI. Keep the
codebase boring, one-way, and typed.

## Routes
- **One route per file.** Each file in `api/` default-exports exactly one `defineRoute`.
- **Path comes from the file location.** `api/customers/[id].ts` → `/api/customers/{id}`. Never hardcode it.
- **All I/O goes through zod.** Declare `request.params/query/body` and `response` as zod schemas. The handler receives validated, typed input — no manual parsing.
- **Protect routes declaratively.** Use `auth: true` on the `defineRoute` (+ a resolver in `serve({ auth })`), never a hand-called `requireAuth(c)` inside the handler — one forgotten call is an IDOR/tenant leak.
- **No `app.all` / raw handlers** except a genuinely schema-less endpoint (e.g. a third-party webhook that must accept any payload). Those are lint-flagged; justify with a comment.

## Banned patterns
- `as never`, `as any` in app code. If you need one, the framework is missing a type — fix it there, not here. (Framework internals may cast at the boundary, with a comment.)
- `c.req.json<T>()` / manual body reads. Use the `body` schema.
- `console.log` in handlers/business code. Use the exported `logger`.
- New dependencies for what a few lines do. Follow the ladder: stdlib → platform → existing dep → a few lines → only then a new dep.

## Structure
- HTTP routes → `api/`. Scheduled jobs → `cron/`. Event-driven jobs → `automations/`. Nothing scheduled or triggered inline in a route.
- Shared helpers → `methods/` (or `lib/`). No business logic in the framework glue.
- Env: validate at boot with `validateEnv([...])`; build one typed `tEnv` object. No scattered `Bun.env.X` reads.

## Scaffolding
Use the CLI instead of freehanding structure:
```
baguette new route customers/create
baguette new cron sendReminders
baguette new automation onPaymentPaid
```

## The principle
One obvious way to do each thing. If you're inventing structure, stop — there's
already a convention. Boring, typed, and deletable beats clever every time.
