import { RedisClient } from "bun";
import type { Context, MiddlewareHandler } from "hono";
import { getConnInfo } from "hono/bun";

/** Fixed-window counter store. `hit` bumps the count and reports time-to-reset. */
export interface RateLimitStore {
  hit(key: string, windowSec: number): Promise<{ count: number; resetSec: number }>;
}

// In-process store — the default. Correct for a single instance; across replicas
// each has its own counter, so use `redisStore` (RATELIMIT_STORE=redis) to share.
export function memoryStore(): RateLimitStore {
  const map = new Map<string, { count: number; expiresAt: number }>();
  return {
    async hit(key, windowSec) {
      const now = Date.now();
      let e = map.get(key);
      if (!e || e.expiresAt <= now) {
        e = { count: 0, expiresAt: now + windowSec * 1000 };
        map.set(key, e);
      }
      e.count++;
      return { count: e.count, resetSec: Math.ceil((e.expiresAt - now) / 1000) };
    },
  };
}

// Redis store — SHARED across replicas. INCR + EXPIRE is the canonical fixed
// window. Bun's built-in client (no dep).
export function redisStore(url: string): RateLimitStore {
  const client = new RedisClient(url);
  return {
    async hit(key, windowSec) {
      const k = `baguette:rl:${key}`;
      const count = Number(await client.send("INCR", [k]));
      if (count === 1) await client.send("EXPIRE", [k, String(windowSec)]);
      const ttl = Number(await client.send("TTL", [k]));
      return { count, resetSec: ttl > 0 ? ttl : windowSec };
    },
  };
}

/**
 * Default store from env:
 *   RATELIMIT_STORE=memory   (default) in-process, single instance
 *   RATELIMIT_STORE=redis + REDIS_URL (or RATELIMIT_REDIS_URL) shared across replicas
 */
export function storeFromEnv(): RateLimitStore {
  if ((Bun.env.RATELIMIT_STORE ?? "memory").toLowerCase() === "redis") {
    const url = Bun.env.RATELIMIT_REDIS_URL ?? Bun.env.REDIS_URL;
    if (!url) throw new Error("RATELIMIT_STORE=redis requires REDIS_URL (or RATELIMIT_REDIS_URL)");
    return redisStore(url);
  }
  return memoryStore();
}

let _default: RateLimitStore | undefined;
/** Process-wide default store, shared by every per-route `rateLimit`. */
export function defaultStore(): RateLimitStore {
  return (_default ??= storeFromEnv());
}

const UNIT: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
export function parseWindow(w: number | string): number {
  if (typeof w === "number") return w;
  const m = /^(\d+)\s*([smhd])$/.exec(w.trim());
  if (!m) throw new Error(`Invalid rate-limit window "${w}" (use e.g. 30, "1m", "15m", "1h")`);
  return Number(m[1]) * UNIT[m[2]];
}

export interface ClientIpOptions {
  /**
   * Header set by a trusted edge that holds the single real client IP, e.g.
   * "cf-connecting-ip" (Cloudflare) or "x-real-ip". Only safe if the origin is
   * reachable ONLY through that edge. Default: env RATELIMIT_IP_HEADER, else none.
   */
  ipHeader?: string;
  /**
   * Number of trusted proxies in front of the app that APPEND to X-Forwarded-For.
   * The client IP is the entry `hops` from the right (the one the outermost trusted
   * proxy saw); everything to its left is client-controlled. 0 = ignore XFF and use
   * the socket address. Default: env RATELIMIT_TRUSTED_HOPS, else 1.
   */
  trustedProxyHops?: number;
}

/**
 * Real client IP for rate-limit keys. Spoof-safe by default: a client can prepend
 * anything to X-Forwarded-For, so the LEFTMOST entry is never trusted. Order:
 *   1. `ipHeader` (if configured and present)
 *   2. X-Forwarded-For entry `trustedProxyHops` from the right (default 1 = last)
 *   3. socket remote address (Bun server.requestIP via hono/bun getConnInfo)
 */
export function clientIp(c: Context, opts: ClientIpOptions = {}): string {
  const ipHeader = opts.ipHeader ?? Bun.env.RATELIMIT_IP_HEADER;
  if (ipHeader) {
    const v = c.req.header(ipHeader)?.trim();
    if (v) return v;
  }
  const raw = opts.trustedProxyHops ?? Number(Bun.env.RATELIMIT_TRUSTED_HOPS || 1);
  const hops = Number.isInteger(raw) && raw >= 0 ? raw : 1;
  const xff = hops > 0 ? c.req.header("x-forwarded-for") : undefined;
  if (xff) {
    const ips = xff.split(",").map((s) => s.trim()).filter(Boolean);
    // Fewer entries than hops: request skipped some proxy hop; take the leftmost we have.
    const ip = ips[Math.max(0, ips.length - hops)];
    if (ip) return ip;
  }
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

export interface RateLimitOptions {
  limit: number;
  /** Window in seconds, or "30s" / "1m" / "15m" / "1h" / "1d". */
  window: number | string;
  /** Bucket key (default: client IP + method + path). Return a stable string. */
  key?: (c: Context) => string;
  message?: string;
}

/**
 * Rate-limit middleware. Per-route via `defineRoute({ rateLimit })`, or by hand in
 * `middleware: [rateLimit({ limit: 5, window: "1m" })]`. Over the limit -> 429 with
 * Retry-After. Default keys by client IP so it stops brute-force + email-bombing;
 * pass `key` to bucket by user/email/etc.
 */
export function rateLimit(opts: RateLimitOptions, store?: RateLimitStore): MiddlewareHandler {
  const windowSec = parseWindow(opts.window);
  const keyFn = opts.key ?? ((c) => `${clientIp(c)}:${c.req.method}:${c.req.path}`);
  return async (c, next) => {
    const s = store ?? defaultStore();
    const { count, resetSec } = await s.hit(keyFn(c), windowSec);
    c.header("X-RateLimit-Limit", String(opts.limit));
    c.header("X-RateLimit-Remaining", String(Math.max(0, opts.limit - count)));
    if (count > opts.limit) {
      c.header("Retry-After", String(resetSec));
      return c.json({ error: opts.message ?? "Too many requests" }, 429);
    }
    await next();
  };
}
