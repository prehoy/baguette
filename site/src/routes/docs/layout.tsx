import { component$, Slot } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import { SiteHeader } from "~/components/chrome";

interface NavItem {
  label: string;
  href: string;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    title: "Guide",
    items: [
      { label: "Getting started", href: "/docs/" },
      { label: "defineRoute", href: "/docs/define-route/" },
      { label: "serve", href: "/docs/serve/" },
      { label: "Security", href: "/docs/security/" },
      { label: "WebSockets", href: "/docs/websockets/" },
    ],
  },
  {
    title: "Optional layers",
    items: [
      { label: "Cron", href: "/docs/cron/" },
      { label: "Automations", href: "/docs/automations/" },
    ],
  },
  {
    title: "Tooling",
    items: [
      { label: "CLI", href: "/docs/cli/" },
      { label: "Clean-code contract", href: "/docs/clean-code-contract/" },
    ],
  },
];

export default component$(() => {
  const loc = useLocation();
  const path = loc.url.pathname;

  return (
    <div class="min-h-screen bg-paper text-ink">
      <div class="mx-auto max-w-6xl px-6 py-7 sm:px-10 md:px-12 md:py-9">
        <SiteHeader active="docs" />

        <div class="mt-10 grid gap-10 md:mt-12 md:grid-cols-[210px_1fr] md:gap-14">
          {/* Nav — full-bleed horizontal scroll strip on mobile, sticky sidebar on desktop */}
          <aside class="-mx-6 border-y-2 border-ink/10 px-6 py-4 sm:-mx-10 sm:px-10 md:mx-0 md:border-0 md:px-0 md:py-0 md:sticky md:top-9 md:h-[calc(100vh-6rem)] md:self-start md:overflow-y-auto">
            <nav class="flex gap-7 overflow-x-auto pb-1 md:flex-col md:gap-8 md:overflow-visible md:border-l-2 md:border-ink/12 md:pb-0 md:pl-5">
              {NAV.map((group) => (
                <div key={group.title} class="flex-none">
                  <p class="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/35 md:mb-3">
                    {group.title}
                  </p>
                  <ul class="flex gap-4 md:flex-col md:gap-1">
                    {group.items.map((item) => {
                      const active = path === item.href;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            class={`block whitespace-nowrap border-b-2 pb-1 text-sm transition-colors md:-ml-5 md:border-b-0 md:border-l-2 md:py-1 md:pl-5 ${
                              active
                                ? "border-crust font-medium text-ink"
                                : "border-transparent text-ink/55 hover:text-ink"
                            }`}
                          >
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div class="min-w-0 pb-24">
            <article class="prose animate-fade-in">
              <Slot />
            </article>
          </div>
        </div>
      </div>
    </div>
  );
});
