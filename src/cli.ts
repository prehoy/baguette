#!/usr/bin/env bun
import { Glob } from "bun";
import { existsSync } from "node:fs";
import path from "node:path";
import { isBaguetteRoute } from "./defineRoute";

const [cmd, sub, arg] = Bun.argv.slice(2);

const HELP = `🥖 baguette

Usage:
  baguette new route <path>          scaffold api/<path>.ts
  baguette new cron <name>           scaffold cron/<name>.ts
  baguette new automation <name>     scaffold automations/<name>.ts
  baguette check                     verify every api/ file exports a route
  baguette --help
`;

const routeTpl = () => `import { defineRoute, z } from "baguette";

export default defineRoute({
  method: "get",
  // TODO: request: { params/query/body: z.object({ ... }) },
  response: z.object({ ok: z.boolean() }),
  handler: (c) => c.json({ ok: true }),
});
`;

const cronTpl = (name: string) => `export const details = {
  name: "${name}",
  log: true,
  cron: { tag: "Every hour", value: "0 * * * *" },
};

export const process = async () => {
  // TODO: job body
};
`;

const automationTpl = (name: string) => `export const details = {
  name: "${name}",
  // trigger fires on a DB row change: "<table>_insert" | "_update" | "_delete"
  trigger: { name: "order_insert", tag: "Order Created" },
};

export const automation = async (payload: string) => {
  const row = JSON.parse(payload);
  // TODO: react to the change
  return { logs: [], status: "SUCCESS" as const };
};
`;

async function scaffold(kind: string, name: string) {
  const spec: Record<string, [string, () => string]> = {
    route: [`api/${name}.ts`, routeTpl],
    cron: [`cron/${name}.ts`, () => cronTpl(name)],
    automation: [`automations/${name}.ts`, () => automationTpl(name)],
  };
  const entry = spec[kind];
  if (!entry) return fail(`unknown scaffold "${kind}" (route|cron|automation)`);
  const [rel, tpl] = entry;
  const file = path.resolve(rel);
  if (await Bun.file(file).exists()) return fail(`${rel} already exists`);
  await Bun.write(file, tpl()); // Bun.write creates parent dirs
  console.log(`✓ created ${rel}`);
}

async function check() {
  const dir = path.resolve("api");
  if (!existsSync(dir)) return fail("no ./api directory");
  const glob = new Glob("**/*.ts");
  const problems: string[] = [];
  let count = 0;
  for await (const rel of glob.scan({ cwd: dir })) {
    if (rel.endsWith(".test.ts")) continue;
    count++;
    const mod = await import(path.join(dir, rel)).catch((e) => {
      problems.push(`${rel}: failed to import — ${e}`);
      return null;
    });
    if (!mod) continue;
    const def = mod.default;
    if (!isBaguetteRoute(def) && typeof def !== "function")
      problems.push(`${rel}: default export must be a defineRoute (or a raw handler)`);
  }
  if (problems.length) {
    console.error(`✗ ${problems.length} problem(s) in ${count} route file(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`✓ ${count} route file(s) OK`);
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (cmd === "new") await scaffold(sub, arg);
else if (cmd === "check") await check();
else console.log(HELP);
