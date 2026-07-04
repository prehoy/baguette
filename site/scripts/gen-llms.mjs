// Generate /llms.txt (index) and /llms-full.txt (all docs concatenated) from the
// real MDX sources so the AI-facing docs never drift from the site. Plain Node
// (the Docker build has no Bun). Runs before every build; output lands in public/.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(siteRoot, "..");
const BASE = "https://usebaguette.com";

const pages = [
  { slug: "", title: "Getting started", file: "src/routes/docs/index.mdx" },
  { slug: "define-route", title: "defineRoute", file: "src/routes/docs/define-route/index.mdx" },
  { slug: "serve", title: "serve", file: "src/routes/docs/serve/index.mdx" },
  { slug: "cron", title: "Cron", file: "src/routes/docs/cron/index.mdx" },
  { slug: "automations", title: "Automations", file: "src/routes/docs/automations/index.mdx" },
  { slug: "cli", title: "CLI", file: "src/routes/docs/cli/index.mdx" },
  { slug: "clean-code-contract", title: "Clean-code contract", file: "src/routes/docs/clean-code-contract/index.mdx" },
];

const stripFrontmatter = (s) => s.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
const firstPara = (md) => {
  for (const raw of md.split("\n")) {
    const l = raw.trim();
    if (l && !l.startsWith("#") && !l.startsWith(">") && !l.startsWith("```")) {
      return l.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*`]/g, "");
    }
  }
  return "";
};

const TAGLINE =
  "Blazingly fast, zero-config Bun + Hono API framework for TypeScript. One zod " +
  "`defineRoute` gives runtime validation, inferred types, OpenAPI/Scalar docs, and " +
  "an error funnel. File-based routing on Bun + Hono. Install: `bun add @prehoy/baguette`.";

let full = `# baguette — full documentation\n\n> ${TAGLINE}\n`;
const index = [];
for (const p of pages) {
  const md = stripFrontmatter(readFileSync(join(siteRoot, p.file), "utf8")); // md keeps its own H1
  full += `\n\n---\n\n${md}\n`;
  const url = `${BASE}/docs/${p.slug ? p.slug + "/" : ""}`;
  index.push(`- [${p.title}](${url}): ${firstPara(md).slice(0, 140)}`);
}
for (const file of ["README.md", "AGENTS.md"]) {
  const fp = join(repoRoot, file);
  if (existsSync(fp)) full += `\n\n---\n\n${readFileSync(fp, "utf8").trim()}\n`;
}
writeFileSync(join(siteRoot, "public/llms-full.txt"), full);

const llms = `# baguette

> ${TAGLINE}

## Docs

${index.join("\n")}

## Full text

- [llms-full.txt](${BASE}/llms-full.txt): every doc page concatenated as plain markdown

## Source

- [GitHub](https://github.com/prehoy/baguette)
- [npm](https://www.npmjs.com/package/@prehoy/baguette)
`;
writeFileSync(join(siteRoot, "public/llms.txt"), llms);

console.log("generated public/llms.txt + public/llms-full.txt");
