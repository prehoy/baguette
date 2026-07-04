import processError from "./processError";

const APP = Bun.env.APP_NAME ?? "baguette";

// Structured JSON to stdout; any OTEL/HyperDX collector reads it from container
// logs. Apps that want shipping/capture can wrap or replace this.
const transport = (level: string, message: string | object) => {
  try {
    const obj: Record<string, unknown> =
      typeof message === "string"
        ? { message }
        : { ...(message as Record<string, unknown>) };
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      obj[k] = trim(typeof v === "string" ? v : JSON.stringify(v));
    }
    console.log(JSON.stringify({ level, app: APP, ...obj }));
  } catch (e) {
    console.log("Logger error", processError(e));
  }
};

const logger = {
  info: (payload: string | object) => transport("info", payload),
  warn: (payload: string | object) => transport("warn", payload),
  error: (payload: string | object) => transport("error", payload),
};
export default logger;

// ponytail: cap oversized values so one huge field can't blow up a log line.
const trim = (s?: string) => (s && s.length > 50000 ? s.slice(0, 1000) + "…" : s);
