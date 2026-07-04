import type { z } from "@hono/zod-openapi";

// Boot-time guard: throw loudly if any required env var is missing, instead of
// failing deep in a handler later. Apps build their own typed `tEnv` object.
export function validateEnv(required: string[]): void {
  const missing = required.filter((k) => !Bun.env[k]);
  if (missing.length) {
    throw new Error(`Missing required ENV variables: ${missing.join(", ")}`);
  }
}

/**
 * Validate + type the environment from a zod schema, once, at boot. Replaces the
 * hand-written per-app env.ts: coercion, defaults, and a clear error listing all
 * missing/invalid vars. Unknown env vars are ignored.
 *
 *   export const env = defineEnv(z.object({
 *     PORT: z.coerce.number().default(3000),
 *     DATABASE_URL: z.string().url(),
 *     AUTOMATIONS: z.enum(["true", "false"]).default("false"),
 *   }));
 */
export function defineEnv<T extends z.ZodType>(schema: T): z.infer<T> {
  const parsed = schema.safeParse(Bun.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${issues}`);
  }
  return parsed.data;
}
