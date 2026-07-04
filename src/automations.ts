import { Glob } from "bun";
import path from "node:path";
import postgres from "postgres";
import logger from "./logger";
import processError from "./processError";

export interface AutomationDefinition {
  details: { name: string; trigger: { name: string; tag?: string } };
  automation: (payload: string) => Promise<{ logs?: string[]; status?: string }>;
}

export interface AutomationOptions {
  dir?: string;
  db: string | postgres.Sql;
  /** Tables to attach pg_notify triggers to (e.g. ["Order", "Payment"]). */
  tables: string[];
  /** Master switch; also honours AUTOMATIONS env by default. */
  enabled?: boolean;
  isEnabled?: (name: string) => boolean | Promise<boolean>;
  onRun?: (name: string, result: unknown) => void;
}

export async function loadAutomations(dir: string): Promise<AutomationDefinition[]> {
  const out: AutomationDefinition[] = [];
  for await (const rel of new Glob("**/*.ts").scan({ cwd: path.resolve(dir) })) {
    if (rel.endsWith(".test.ts")) continue;
    const mod = (await import(path.join(path.resolve(dir), rel))) as AutomationDefinition;
    if (mod?.details?.trigger?.name && typeof mod.automation === "function") out.push(mod);
    else logger.warn({ message: `Automation file ${rel} missing details/automation; skipped` });
  }
  return out;
}

// Route one NOTIFY payload to every automation registered for that trigger.
// Factored out so routing is testable without a database.
export async function dispatchAutomation(
  automations: AutomationDefinition[],
  trigger: string,
  payload: string,
  ctx: Pick<AutomationOptions, "isEnabled" | "onRun"> = {},
): Promise<void> {
  for (const a of automations) {
    if (a.details.trigger.name !== trigger) continue;
    if (ctx.isEnabled && !(await ctx.isEnabled(a.details.name))) continue;
    try {
      const result = await a.automation(payload);
      ctx.onRun?.(a.details.name, result);
    } catch (e) {
      logger.error({
        message: `Error in automation ${a.details.name}`,
        error: processError(e),
      });
    }
  }
}

// Idempotent: creates a NOTIFY trigger on each table for insert/update/delete.
// Same DDL the house repos used, parameterized. Raw SQL — ORM-agnostic.
export async function ensureTriggers(sql: postgres.Sql, tables: string[]): Promise<void> {
  for (const table of tables) {
    const t = table.toLowerCase();
    const fn = `notify_${t}_changes`;
    const trig = `${t}_notifications_trigger`;
    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION ${fn}() RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN PERFORM pg_notify('${t}_insert', row_to_json(NEW)::text);
        ELSIF TG_OP = 'UPDATE' THEN PERFORM pg_notify('${t}_update', json_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))::text);
        ELSIF TG_OP = 'DELETE' THEN PERFORM pg_notify('${t}_delete', row_to_json(OLD)::text);
        END IF;
        RETURN NULL;
      END; $$ LANGUAGE plpgsql;`);
    await sql.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = '${trig}') THEN
          CREATE TRIGGER ${trig} AFTER INSERT OR UPDATE OR DELETE ON "${table}"
          FOR EACH ROW EXECUTE FUNCTION ${fn}();
        END IF;
      END $$;`);
  }
}

export async function startAutomations(opts: AutomationOptions): Promise<void> {
  const enabled = opts.enabled ?? Bun.env.AUTOMATIONS === "true";
  if (!enabled) {
    logger.info({ message: "Automations disabled (set AUTOMATIONS=true to enable)" });
    return;
  }
  const sql = typeof opts.db === "string" ? postgres(opts.db) : opts.db;
  const automations = await loadAutomations(opts.dir ?? "./automations");
  await ensureTriggers(sql, opts.tables);

  const channels = new Set(automations.map((a) => a.details.trigger.name));
  for (const channel of channels) {
    await sql.listen(channel, (payload) =>
      dispatchAutomation(automations, channel, payload, { isEnabled: opts.isEnabled, onRun: opts.onRun }),
    );
  }
  logger.info({
    message: `Automations listening on ${channels.size} channel(s), ${automations.length} handler(s)`,
  });
}
