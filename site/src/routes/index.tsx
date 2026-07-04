import { component$ } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import { CodeBlock } from "~/components/code";
import { SiteHeader, SiteFooter } from "~/components/chrome";

const routeSample = `// api/customers/[id].ts
import { defineRoute, z } from "baguette";

export default defineRoute({
  method: "get",
  request: { params: z.object({ id: z.string() }) },
  response: z.object({ id: z.string(), name: z.string() }),
  handler: (c, { params }) =>
    c.json({ id: params.id, name: "Ada" }),
});`;

const serveSample = `// server.ts
import { serve } from "baguette";

serve({ routesDir: "./api" });
// routes loaded · validation on · docs at /api/docs`;

const checkSample = `$ baguette check

  api/customers/create.ts
    warn  hardcoded path — derive it from the file location
    warn  manual c.req.json() — declare a request.body schema

  api/legacy/proxy.ts
    error  'as any' in app code — the framework is missing a type

  2 warnings · 1 error · 14 routes clean`;

const features = [
  {
    n: "01",
    title: "File-based routing",
    body: "The file's location is the URL. api/customers/[id].ts becomes /api/customers/{id}. Nothing to register, nothing to hardcode.",
  },
  {
    n: "02",
    title: "zod-first, one source of truth",
    body: "Declare request and response as zod schemas once. Validation, inferred handler types, and the OpenAPI spec all fall out of that single declaration.",
  },
  {
    n: "03",
    title: "Auto OpenAPI docs",
    body: "A live Scalar UI at /api/docs and the raw spec at /api/doc — generated from your schemas, never hand-wired, never stale.",
  },
  {
    n: "04",
    title: "ORM-agnostic",
    body: "The framework imports no ORM. Bring Prisma, Drizzle, or raw SQL. Nothing in the hot path you didn't put there.",
  },
  {
    n: "05",
    title: "Optional cron & automations",
    body: "Drop a file in cron/ for scheduled jobs (Postgres advisory lock) or automations/ for LISTEN/NOTIFY event handlers. Off until the directory exists.",
  },
  {
    n: "06",
    title: "AI-proof by convention",
    body: "One obvious way to do each thing, enforced. A shipped clean-code contract, a baguette/eslint preset, and baguette check keep the codebase boring and typed.",
  },
];

const pipeline = [
  { k: "Runtime validation", d: "Bad input never reaches your handler — 400 automatically." },
  { k: "Inferred TS types", d: "params, query and body arrive fully typed. No casts." },
  { k: "OpenAPI + Scalar docs", d: "The spec and the docs page write themselves." },
  { k: "Error funnel", d: "Unhandled throws become a clean 500. One place to look." },
];

export default component$(() => {
  return (
    <main class="relative min-h-screen bg-paper text-ink">
      {/* Brutalist frame border */}
      <div class="pointer-events-none absolute inset-3 border-2 border-ink/15 sm:inset-5 md:inset-8" />

      <div class="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-7 sm:px-10 md:px-16 md:py-11">
        <SiteHeader />

        {/* ---------------- HERO ---------------- */}
        <section class="grid flex-1 items-center gap-14 py-16 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div>
            <div class="animate-fade-up flex items-center gap-3">
              <span class="h-px w-8 bg-crust" />
              <span class="font-mono text-[11px] uppercase tracking-[0.28em] text-crust-deep">
                Bun + Hono API framework
              </span>
            </div>

            <h1 class="animate-fade-up delay-100 mt-6 font-display text-[clamp(2.7rem,7vw,5.2rem)] uppercase leading-[0.9] tracking-[0.005em]">
              Blazingly fast.
              <br />
              Zero-config.
              <br />
              <span class="text-crust">Type-safe</span>{" "}
              <span class="text-ink/35">end to end.</span>
            </h1>

            <p class="animate-fade-up delay-200 mt-7 max-w-md text-lg leading-relaxed text-ink/65">
              The framework your AI can&rsquo;t make a mess of. Drop a file, get
              a typed, documented, validated endpoint.
            </p>

            <div class="animate-fade-up delay-300 mt-9 flex flex-wrap items-center gap-4">
              <div class="flex items-stretch border-2 border-ink">
                <span
                  aria-hidden="true"
                  class="flex items-center bg-ink px-3 font-mono text-sm text-crust"
                >
                  $
                </span>
                <code class="flex items-center px-4 py-2.5 font-mono text-sm font-medium tracking-tight text-ink">
                  bun add baguette
                </code>
              </div>
              <Link
                href="/docs/"
                class="group inline-flex items-center gap-2 bg-ink px-6 py-3 text-sm font-medium uppercase tracking-[0.14em] text-paper transition-colors hover:bg-crust hover:text-ink"
              >
                Read the docs
                <span class="transition-transform group-hover:translate-x-1">
                  &rarr;
                </span>
              </Link>
            </div>
          </div>

          {/* Hero code */}
          <div class="animate-fade-up delay-400 lg:pt-4">
            <CodeBlock
              code={routeSample}
              filename="api/customers/[id].ts"
              class="shadow-[10px_10px_0_0_rgba(10,10,10,0.9)]"
            />
            <p class="mt-4 flex items-center gap-2 pl-1 text-[12px] text-ink/45">
              <span class="h-1.5 w-1.5 bg-crust" />
              One zod declaration &rarr; validation, types, docs, and an error
              funnel.
            </p>
          </div>
        </section>

        {/* ---------------- EXPLAINER: one file -> endpoint ---------------- */}
        <section class="border-t-2 border-ink py-16 md:py-24">
          <div class="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div>
              <span class="font-mono text-[11px] uppercase tracking-[0.28em] text-ink/40">
                The whole idea
              </span>
              <h2 class="mt-4 font-display text-[clamp(2rem,4.5vw,3.4rem)] uppercase leading-[0.95]">
                One file becomes a typed, documented endpoint.
              </h2>
              <p class="mt-6 max-w-md leading-relaxed text-ink/65">
                Point <code class="bg-ink/6 px-1.5 py-0.5 font-mono text-[0.85em]">serve()</code>{" "}
                at a directory. Every file that default-exports a{" "}
                <code class="bg-ink/6 px-1.5 py-0.5 font-mono text-[0.85em]">defineRoute</code>{" "}
                is mounted at the path its location implies. That&rsquo;s the
                entire wiring step.
              </p>
              <div class="mt-8">
                <CodeBlock code={serveSample} filename="server.ts" />
              </div>
            </div>

            <div class="grid gap-px border-2 border-ink bg-ink/15 sm:grid-cols-2">
              {pipeline.map((p, i) => (
                <div
                  key={p.k}
                  class="group bg-paper p-6 transition-colors hover:bg-ink hover:text-paper md:p-8"
                >
                  <span class="font-mono text-[11px] text-crust-deep group-hover:text-crust">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 class="mt-3 text-base font-semibold tracking-tight">
                    {p.k}
                  </h3>
                  <p class="mt-2 text-sm leading-relaxed text-ink/55 group-hover:text-paper/70">
                    {p.d}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- FEATURE GRID ---------------- */}
        <section class="border-t-2 border-ink py-16 md:py-24">
          <div class="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h2 class="max-w-xl font-display text-[clamp(2rem,4.5vw,3.4rem)] uppercase leading-[0.95]">
              Everything, by convention.
            </h2>
            <span class="font-mono text-[11px] uppercase tracking-[0.28em] text-ink/40">
              Six moving parts
            </span>
          </div>

          <div class="grid gap-px border-2 border-ink bg-ink/15 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <article
                key={f.n}
                class="group flex flex-col bg-paper p-7 transition-colors hover:bg-ink hover:text-paper md:p-8"
              >
                <span class="font-display text-4xl text-ink/12 transition-colors group-hover:text-crust">
                  {f.n}
                </span>
                <h3 class="mt-5 text-lg font-semibold tracking-tight">
                  {f.title}
                </h3>
                <p class="mt-3 text-sm leading-relaxed text-ink/55 group-hover:text-paper/70">
                  {f.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------------- AI CAN'T MESS IT UP ---------------- */}
        <section class="border-t-2 border-ink py-16 md:py-24">
          <div class="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div>
              <div class="flex items-center gap-3">
                <span class="h-px w-8 bg-crust" />
                <span class="font-mono text-[11px] uppercase tracking-[0.28em] text-crust-deep">
                  The moat
                </span>
              </div>
              <h2 class="mt-5 font-display text-[clamp(2rem,4.5vw,3.4rem)] uppercase leading-[0.95]">
                The framework your AI can&rsquo;t make a mess of.
              </h2>
              <p class="mt-6 max-w-lg leading-relaxed text-ink/65">
                Generated code drifts because there are a hundred ways to do
                everything. baguette ships{" "}
                <strong class="font-semibold text-ink">one</strong>. A clean-code
                contract in <code class="bg-ink/6 px-1.5 py-0.5 font-mono text-[0.85em]">AGENTS.md</code>,
                a <code class="bg-ink/6 px-1.5 py-0.5 font-mono text-[0.85em]">baguette/eslint</code>{" "}
                preset, and a checker turn those conventions into CI failures &mdash;
                so an agent physically can&rsquo;t merge the mess.
              </p>

              <ul class="mt-8 grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
                {[
                  "One route per file, path from location",
                  "All I/O through zod — no manual parsing",
                  "No as any / as never in app code",
                  "logger, not console.log",
                  "Scaffold with baguette new, never freehand",
                  "Boring, typed, and deletable beats clever",
                ].map((item) => (
                  <li key={item} class="flex items-start gap-3 text-sm text-ink/70">
                    <span class="mt-1.5 h-2 w-2 flex-none bg-crust" />
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href="/docs/clean-code-contract/"
                class="mt-9 inline-flex items-center gap-2 border-b-2 border-crust pb-1 text-sm font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:border-ink"
              >
                Read the contract &rarr;
              </Link>
            </div>

            <div class="lg:pt-16">
              <CodeBlock code={checkSample} filename="terminal" />
              <p class="mt-4 pl-1 text-[12px] text-ink/45">
                <code class="font-mono">baguette check</code> runs in CI. Clean
                code passes; clever code doesn&rsquo;t.
              </p>
            </div>
          </div>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
});

export const head: DocumentHead = {
  title: "baguette — Blazingly fast, zero-config Bun + Hono API framework",
  meta: [
    {
      name: "description",
      content:
        "Blazingly fast. Zero-config. Type-safe end to end. Drop a file, get a typed, documented, validated endpoint. The Bun + Hono API framework your AI can't make a mess of.",
    },
    {
      property: "og:title",
      content: "baguette — Blazingly fast, zero-config Bun + Hono API framework",
    },
    {
      property: "og:description",
      content:
        "One zod declaration gives you runtime validation, inferred types, OpenAPI docs, and an error funnel. File-based routing on Bun + Hono.",
    },
  ],
};
