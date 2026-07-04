// Boot-time guard: throw loudly if any required env var is missing, instead of
// failing deep in a handler later. Apps build their own typed `tEnv` object.
export function validateEnv(required: string[]): void {
  const missing = required.filter((k) => !Bun.env[k]);
  if (missing.length) {
    throw new Error(`Missing required ENV variables: ${missing.join(", ")}`);
  }
}
