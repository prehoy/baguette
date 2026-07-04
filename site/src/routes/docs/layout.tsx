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

        <div class="mt-12 grid gap-12 md:grid-cols-[220px_1fr] md:gap-14">
          {/* Sidebar */}
          <aside class="md:sticky md:top-9 md:h-[calc(100vh-6rem)] md:self-start md:overflow-y-auto">
            <nav class="flex flex-col gap-8 border-l-2 border-ink/12 pl-5">
              {NAV.map((group) => (
                <div key={group.title}>
                  <p class="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/35">
                    {group.title}
                  </p>
                  <ul class="flex flex-col gap-1">
                    {group.items.map((item) => {
                      const active = path === item.href;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            class={`-ml-5 block border-l-2 py-1 pl-5 text-sm transition-colors ${
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
