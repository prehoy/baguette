import { component$, Slot } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

const GITHUB = "https://github.com/darka-io/baguette";

export const Wordmark = component$<{ class?: string }>(({ class: cls }) => (
  <Link
    href="/"
    class={`group inline-flex items-center gap-2.5 ${cls ?? ""}`}
    aria-label="baguette — home"
  >
    <span class="h-4 w-4 bg-crust transition-transform group-hover:rotate-45" />
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
    <div class="mt-10 flex items-center justify-between border-t border-ink/10 pt-5">
      <div class="flex gap-2">
        <span class="h-3.5 w-3.5 bg-ink" />
        <span class="h-3.5 w-3.5 border-2 border-ink" />
        <span class="h-3.5 w-3.5 bg-crust" />
      </div>
      <span class="text-[10px] uppercase tracking-[0.2em] text-ink/30">
        MIT · usebaguette.com
      </span>
    </div>
  </footer>
));

export const PageShell = component$(() => (
  <div>
    <Slot />
  </div>
));
