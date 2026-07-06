import { $, component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";

type Line = { kind: "cmd" | "out" | "json" | "comment"; text: string };

// The whole pitch in four commands: scaffold → run → curl → typed JSON.
const SCRIPT: Line[] = [
  { kind: "cmd", text: "bun create baguette my-api" },
  { kind: "out", text: "🥖 Created my-api" },
  { kind: "cmd", text: "cd my-api && bun run dev" },
  { kind: "out", text: "baguette listening on :3000  ·  docs at /api/docs" },
  { kind: "comment", text: "# drop a file → api/customers/[id].ts" },
  { kind: "cmd", text: "curl localhost:3000/api/customers/42" },
  { kind: "json", text: '{ "id": "42", "name": "Ada" }' },
  { kind: "comment", text: "# typed · validated · documented — zero config" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const TerminalDemo = component$(() => {
  const done = useSignal<Line[]>([]);
  const typing = useSignal<string>("");

  const play = $(async () => {
    done.value = [];
    typing.value = "";
    for (const step of SCRIPT) {
      if (step.kind === "cmd") {
        for (let i = 1; i <= step.text.length; i++) {
          typing.value = step.text.slice(0, i);
          await sleep(24);
        }
        await sleep(260);
        done.value = [...done.value, { kind: "cmd", text: step.text }];
        typing.value = "";
      } else {
        await sleep(step.kind === "comment" ? 260 : 420);
        done.value = [...done.value, step];
      }
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    play();
  });

  return (
    <div class="border-2 border-ink bg-ink shadow-[10px_10px_0_0_rgba(10,10,10,0.9)]">
      <div class="flex items-center justify-between border-b border-white/15 px-4 py-2.5">
        <span class="font-mono text-[11px] tracking-wider text-white/55">zsh — my-api</span>
        <div class="flex gap-1.5">
          <span class="h-2 w-2 bg-crust" />
          <span class="h-2 w-2 bg-white/25" />
          <span class="h-2 w-2 bg-white/25" />
        </div>
      </div>
      <pre class="code-frame min-h-[15rem] px-4 py-4 md:min-h-[16rem] md:px-5">
        {done.value.map((l, i) => (
          <div key={i}>
            {l.kind === "cmd" && (
              <span>
                <span class="text-crust">$</span> <span class="text-white/90">{l.text}</span>
              </span>
            )}
            {l.kind === "out" && <span class="text-white/55">{l.text}</span>}
            {l.kind === "json" && <span class="tok-str">{l.text}</span>}
            {l.kind === "comment" && <span class="tok-com italic">{l.text}</span>}
          </div>
        ))}
        {typing.value && (
          <div>
            <span class="text-crust">$</span> <span class="text-white/90">{typing.value}</span>
            <span class="term-cursor" />
          </div>
        )}
      </pre>
      <div class="flex justify-end border-t border-white/10 px-4 py-2">
        <button
          type="button"
          onClick$={play}
          class="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40 transition-colors hover:text-crust"
        >
          ↻ replay
        </button>
      </div>
    </div>
  );
});
