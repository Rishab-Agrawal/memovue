import { headers } from "next/headers";

/**
 * ponytail: in-process, because MemoVue runs as one Railway container. Swap the Map for Redis
 * if it ever runs as several replicas; the call sites don't change.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Keep the Map from growing without bound on a long-lived server.
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

/** The same check, shaped as a route handler's 429. `null` means carry on. */
export function limited(key: string, limit: number, windowSeconds: number): Response | null {
  const result = rateLimit(key, limit, windowSeconds);
  if (result.ok) return null;

  return Response.json(
    { error: "rate_limited" },
    { status: 429, headers: { "retry-after": String(result.retryAfterSeconds) } },
  );
}

/* ------------------------------------------------------------------ wrong guesses */

/**
 * A budget only wrong answers spend. A venue shares one IP, so counting requests would lock out
 * a whole wedding; guests arrive with codes and names that exist, while a script walking the
 * code space runs out after ten misses. One bucket per IP across every guessing surface.
 */
const GUESS_LIMIT = 10;
const GUESS_WINDOW_SECONDS = 600;

/** Whether this caller has already spent their wrong answers. Costs nothing to ask. */
export function outOfGuesses(ip: string): boolean {
  const bucket = buckets.get(`guess:${ip}`);
  return bucket !== undefined && bucket.resetAt > Date.now() && bucket.count >= GUESS_LIMIT;
}

/** Records one. Call it only when the code or the name turned out not to exist. */
export function wrongGuess(ip: string): void {
  rateLimit(`guess:${ip}`, GUESS_LIMIT, GUESS_WINDOW_SECONDS);
}

/* ------------------------------------------------------------------ sign-in */

/** Google sign-in attempts per address, spent by both `/start` and `/callback`. */
export const OAUTH_LIMIT = 30;
export const OAUTH_WINDOW_SECONDS = 600;

/* ------------------------------------------------------------------ alerts */

/**
 * Keeps the alarm channel from becoming the outage: the same fault is announced once per ten
 * minutes, with a ceiling of twenty faults an hour, so Telegram never rate-limits the bot.
 */
export function shouldAlert(key: string): boolean {
  return rateLimit(`alert:${key}`, 1, 600).ok && rateLimit("alert:all", 20, 3_600).ok;
}

/* ------------------------------------------------------------------ who is calling */

/**
 * The caller's address, from a header the caller cannot choose.
 *
 * Never `x-forwarded-for`, which the client can send. `cf-connecting-ip` first, because the
 * domain is proxied through Cloudflare, which overwrites it — behind Cloudflare `x-real-ip` names
 * a Cloudflare machine. `x-real-ip` for a deployment with nothing in front of Railway.
 *
 * ponytail: trusts `cf-connecting-ip` because the only public route in is Cloudflare. A request
 * sent straight to Railway's edge could forge it; fix that at the network (a Cloudflare Tunnel).
 */
function ipFrom(source: Headers): string {
  return (
    source.get("cf-connecting-ip")?.trim() || source.get("x-real-ip")?.trim() || "unknown"
  );
}

/** For route handlers, which are handed the request. */
export function clientIp(request: Request): string {
  return ipFrom(request.headers);
}

/** For server actions, which are not. */
export async function callerIp(): Promise<string> {
  return ipFrom(await headers());
}
