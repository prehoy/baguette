#!/usr/bin/env bun
import { cp, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const name = process.argv[2];
if (!name || name.startsWith("-")) {
  console.error("Usage: bun create baguette <app-name>");
  process.exit(1);
}

const dir = path.resolve(name);
if (existsSync(dir)) {
  console.error(`✗ ${name} already exists`);
  process.exit(1);
}

const templateDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "template");
await cp(templateDir, dir, { recursive: true });

// Substitute the app name into package.json.
const pkgPath = path.join(dir, "package.json");
await writeFile(pkgPath, (await readFile(pkgPath, "utf8")).replaceAll("{{name}}", path.basename(dir)));

// npm/bun strip a literal .gitignore from published packages, so the template
// ships it as _gitignore — restore the real name on scaffold.
const shipped = path.join(dir, "_gitignore");
if (existsSync(shipped)) await rename(shipped, path.join(dir, ".gitignore"));

console.log(`
🥖 Created ${name}

  cd ${name}
  bun install
  bun run dev        →  http://localhost:3000   ·   docs at /api/docs

Add a route: drop a file in api/. Next: auth, cron, queues, email — https://usebaguette.com/docs
Ship it managed on Berth: https://useberth.com
`);
