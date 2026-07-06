import { $, component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";

/**
 * Cookie consent banner wired to Google Consent Mode v2. GTM loads on every page,
 * but analytics/ad storage stays DENIED (set as the default in root.tsx) until the
 * visitor accepts here — so nothing is tracked without consent. The choice is
 * remembered in localStorage; root.tsx re-applies "granted" on return visits.
 */
export const CookieConsent = component$(() => {
  const show = useSignal(false);

  // Client-only: show the banner if no prior choice exists. (Trivial localStorage
  // read — useVisibleTask$ is the right tool here.)
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    try {
      if (!localStorage.getItem("cookie-consent")) show.value = true;
    } catch {
      /* localStorage blocked — don't show, don't track */
    }
  });

  const decide = $((choice: "granted" | "denied") => {
    try {
      localStorage.setItem("cookie-consent", choice);
    } catch {
      /* ignore */
    }
    const w = window as unknown as { gtag?: (...a: unknown[]) => void; dataLayer?: unknown[] };
    const gtag = w.gtag ?? ((...a: unknown[]) => (w.dataLayer ||= []).push(a));
    gtag("consent", "update", {
      analytics_storage: choice,
      ad_storage: choice,
      ad_user_data: choice,
      ad_personalization: choice,
    });
    show.value = false;
  });

  return (
    <>
      {show.value && (
        <div
          role="dialog"
          aria-label="Cookie consent"
          class="fixed inset-x-3 bottom-3 z-50 border-2 border-ink bg-paper p-5 shadow-[6px_6px_0_0_rgba(10,10,10,0.9)] sm:inset-x-5 sm:bottom-5 md:left-auto md:right-8 md:max-w-sm"
        >
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 flex-none bg-crust" />
            <span class="font-mono text-[10px] uppercase tracking-[0.25em] text-crust-deep">
              Cookies
            </span>
          </div>
          <p class="mt-3 text-sm leading-relaxed text-ink/75">
            We use analytics cookies to understand how baguette is used. Nothing is tracked until
            you accept.
          </p>
          <div class="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick$={() => decide("granted")}
              class="bg-ink px-5 py-2 text-xs font-medium uppercase tracking-[0.14em] text-paper transition-colors hover:bg-crust hover:text-ink"
            >
              Accept
            </button>
            <button
              type="button"
              onClick$={() => decide("denied")}
              class="border-2 border-ink px-5 py-2 text-xs font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:bg-ink hover:text-paper"
            >
              Decline
            </button>
          </div>
        </div>
      )}
    </>
  );
});
