import { component$, Slot } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

const GITHUB = "https://github.com/prehoy/baguette";

export const BaguetteMark = component$<{ class?: string }>(({ class: cls }) => (
  <svg
    viewBox="0 0 64 64"
    class={`flex-none ${cls ?? "h-5 w-5"}`}
    aria-hidden="true"
    fill="none"
  >
    <g transform="rotate(-35 32 32)">
      <rect
        x="5"
        y="24"
        width="54"
        height="16"
        rx="8"
        fill="#c8963e"
        stroke="#0a0a0a"
        stroke-width="3.6"
      />
      <g stroke="#0a0a0a" stroke-width="2.8" stroke-linecap="round">
        <line x1="17" y1="29.5" x2="22" y2="35.5" />
        <line x1="26" y1="29.5" x2="31" y2="35.5" />
        <line x1="35" y1="29.5" x2="40" y2="35.5" />
        <line x1="44" y1="29.5" x2="49" y2="35.5" />
      </g>
    </g>
  </svg>
));

export const Wordmark = component$<{ class?: string }>(({ class: cls }) => (
  <Link
    href="/"
    class={`group inline-flex items-center gap-2.5 ${cls ?? ""}`}
    aria-label="baguette — home"
  >
    <BaguetteMark class="h-6 w-6 transition-transform group-hover:-rotate-6" />
    <span class="font-body text-[17px] font-bold leading-none tracking-tight text-ink">
      baguette
    </span>
  </Link>
));

export const SiteHeader = component$<{ active?: "docs" }>(({ active }) => (
  <header class="flex items-center justify-between">
    <Wordmark class="animate-fade-in" />
    <nav class="flex items-center gap-6 animate-fade-in delay-100 sm:gap-8">
      <Link
        href="/docs/"
        class={`text-xs font-medium uppercase tracking-[0.18em] transition-colors hover:text-ink ${
          active === "docs" ? "text-ink" : "text-ink/45"
        }`}
      >
        Docs
      </Link>
      <a
        href={GITHUB}
        target="_blank"
        rel="noreferrer"
        class="text-xs font-medium uppercase tracking-[0.18em] text-ink/45 transition-colors hover:text-ink"
      >
        GitHub
      </a>
    </nav>
  </header>
));

export const SiteFooter = component$(() => (
  <footer class="border-t-2 border-ink/15 pt-8">
    <div class="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
      <div class="max-w-sm">
        <Wordmark />
        <p class="mt-4 text-[13px] leading-relaxed text-ink/45">
          Blazingly fast, zero-config Bun + Hono API framework. Drop a file, get
          a typed, documented, validated endpoint.
        </p>
      </div>
      <div class="flex gap-12">
        <div class="flex flex-col gap-2.5">
          <span class="mb-1 text-[10px] uppercase tracking-[0.25em] text-ink/35">
            Learn
          </span>
          <Link
            href="/docs/"
            class="text-sm text-ink/60 transition-colors hover:text-ink"
          >
            Documentation
          </Link>
          <Link
            href="/docs/define-route/"
            class="text-sm text-ink/60 transition-colors hover:text-ink"
          >
            defineRoute
          </Link>
          <Link
            href="/docs/clean-code-contract/"
            class="text-sm text-ink/60 transition-colors hover:text-ink"
          >
            Clean-code contract
          </Link>
          <a
            href="/llms.txt"
            class="text-sm text-ink/60 transition-colors hover:text-ink"
          >
            llms.txt <span class="text-ink/35">(for AI)</span>
          </a>
        </div>
        <div class="flex flex-col gap-2.5">
          <span class="mb-1 text-[10px] uppercase tracking-[0.25em] text-ink/35">
            Source
          </span>
          <a
            href={GITHUB}
            target="_blank"
            rel="noreferrer"
            class="text-sm text-ink/60 transition-colors hover:text-ink"
          >
            GitHub
          </a>
          <a
            href={`${GITHUB}/issues`}
            target="_blank"
            rel="noreferrer"
            class="text-sm text-ink/60 transition-colors hover:text-ink"
          >
            Issues
          </a>
        </div>
      </div>
    </div>
    <div class="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-5">
      <div class="flex gap-2">
        <span class="h-3.5 w-3.5 bg-ink" />
        <span class="h-3.5 w-3.5 border-2 border-ink" />
        <span class="h-3.5 w-3.5 bg-crust" />
      </div>
      <span class="text-[10px] uppercase tracking-[0.2em] text-ink/30">
        A{" "}
        <a
          href="https://prehoy.com"
          target="_blank"
          rel="noreferrer"
          class="text-ink/50 underline decoration-crust decoration-2 underline-offset-2 transition-colors hover:text-ink"
        >
          Prehoy Industries
        </a>{" "}
        Project · MIT · usebaguette.com
      </span>
    </div>
  </footer>
));

export const PageShell = component$(() => (
  <div>
    <Slot />
  </div>
));
