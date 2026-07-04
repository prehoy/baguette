import { component$ } from "@builder.io/qwik";

/**
 * Zero-dependency, build-time TS/JS syntax highlighter. Runs during SSR and
 * emits <span> tokens styled by .code-frame rules in global.css. Intentionally
 * small — we do NOT ship a runtime highlighter.
 */
const KEYWORDS = new Set([
  "import",
  "export",
  "default",
  "const",
  "let",
  "var",
  "from",
  "return",
  "async",
  "await",
  "function",
  "new",
  "type",
  "interface",
  "extends",
  "as",
  "of",
  "in",
  "if",
  "else",
]);

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// One master tokenizer pass so tokens never clobber each other.
const TOKEN =
  /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|([A-Za-z_$][\w$]*)|(\s+)|([^\w\s])/g;

function highlight(code: string): string {
  let out = "";
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  let prevNonSpace = "";
  while ((m = TOKEN.exec(code)) !== null) {
    const [, comment, str, word, ws, punc] = m;
    if (comment) {
      out += `<span class="tok-com">${escapeHtml(comment)}</span>`;
    } else if (str) {
      out += `<span class="tok-str">${escapeHtml(str)}</span>`;
    } else if (word) {
      const rest = code.slice(TOKEN.lastIndex);
      const isCall = /^\s*\(/.test(rest);
      if (KEYWORDS.has(word)) {
        out += `<span class="tok-key">${word}</span>`;
      } else if (isCall) {
        out += `<span class="tok-fn">${word}</span>`;
      } else if (prevNonSpace === "." ) {
        out += word; // property access — leave neutral
      } else if (/^[A-Z]/.test(word)) {
        out += `<span class="tok-type">${word}</span>`;
      } else {
        out += word;
      }
      prevNonSpace = word;
      continue;
    } else if (ws) {
      out += ws;
      continue;
    } else if (punc) {
      out += `<span class="tok-punc">${escapeHtml(punc)}</span>`;
      prevNonSpace = punc;
      continue;
    }
    prevNonSpace = "";
  }
  return out;
}

interface CodeBlockProps {
  code: string;
  filename?: string;
  class?: string;
}

export const CodeBlock = component$<CodeBlockProps>(
  ({ code, filename, class: cls }) => {
    const html = highlight(code.replace(/\n$/, ""));
    return (
      <div class={`border-2 border-ink bg-ink ${cls ?? ""}`}>
        {filename && (
          <div class="flex items-center justify-between border-b border-white/15 px-4 py-2.5">
            <span class="font-mono text-[11px] tracking-wider text-white/55">
              {filename}
            </span>
            <div class="flex gap-1.5">
              <span class="h-2 w-2 bg-crust" />
              <span class="h-2 w-2 bg-white/25" />
              <span class="h-2 w-2 bg-white/25" />
            </div>
          </div>
        )}
        <pre class="code-frame px-4 py-4 md:px-5 md:py-5">
          <code dangerouslySetInnerHTML={html} />
        </pre>
      </div>
    );
  },
);
