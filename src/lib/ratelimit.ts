import { headers } from "next/headers";

/**
 * Deliberately in-process. MemoVue runs as a single Railway container, so a shared store
 * would be infrastructure for a problem we don't have yet. If this ever scales to multiple
 * replicas, swap the Map for Redis — the call sites don't change.
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

export interface RateLimitResult {
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

/**
 * The same check, already shaped as the refusal a route handler returns. `null` means carry
 * on, so every call site reads `const over = limited(...); if (over) return over;`.
 *
 * `retry-after` is set from the same number the body would have carried, which is what a
 * well-behaved client — and the upload queue's backoff — actually reads.
 */
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
 * A budget that only wrong answers spend.
 *
 * The identifiers a stranger can attack are a roll code and a guest's name, and both are
 * reached from screens a whole wedding shares one wifi router to load. Counting *requests*
 * per IP there is the wrong instrument: 200 guests scanning the card on their table look
 * exactly like a script, so any limit tight enough to stop the script closes the door on
 * the event it was protecting.
 *
 * What separates them is that guests arrive with codes and names that exist. So the budget
 * is spent on misses only — an unknown roll code, a name nobody in the roll is using. A
 * venue full of people never touches it; something walking the 31^6 code space runs out
 * after ten.
 *
 * One shared bucket per IP across all three guessing surfaces, because they are one
 * activity: trying identifiers until something answers.
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

/**
 * How fast one address may attempt a Google sign-in.
 *
 * Every other budget in the app is written at the one place that spends it. This one is here
 * because it is spent in two — `/start` and `/callback` are halves of a single round trip,
 * and a budget on only the second half is a budget on nothing. Thirty is fifteen whole
 * attempts in ten minutes: more than anyone signing in needs, and immediate for a loop
 * minting state cookies or replaying codes at Google.
 */
export const OAUTH_LIMIT = 30;
export const OAUTH_WINDOW_SECONDS = 600;

/* ------------------------------------------------------------------ alerts */

/**
 * What stops the alarm channel from becoming the outage.
 *
 * A crash in a page every guest loads is not one message: it is one per guest per reload, and
 * a hundred of those get the bot rate-limited by Telegram at the exact moment the alerts
 * matter most. So the same fault is announced once and then goes quiet for ten minutes, with
 * a hard ceiling across all faults on top — an hour in which twenty distinct things broke is
 * fully described by the first twenty of them.
 *
 * Two buckets rather than a mechanism of its own, because this is the same question the rest
 * of this file answers: how often may one key do a thing. The per-fault budget is spent first
 * and spent even when the ceiling refuses, which is the right way round — past twenty faults
 * in an hour, nothing is learned by hearing the twenty-first sooner.
 */
export function shouldAlert(key: string): boolean {
  return rateLimit(`alert:${key}`, 1, 600).ok && rateLimit("alert:all", 20, 3_600).ok;
}

/* ------------------------------------------------------------------ who is calling */

/**
 * The caller's address, from the one header that is not the caller's to choose.
 *
 * `x-forwarded-for` used to be read first, and it is now not read at all. Whatever arrives in
 * XFF came from the other end of the connection, so keying a budget on it handed a fresh
 * bucket to anyone who thought to send the header. Reading its *last* entry does not rescue
 * it either: that entry is trustworthy only because a proxy appended it, and a request that
 * reached us without passing through one has nobody who could have — indistinguishable, from
 * inside this function, from the case where one did.
 *
 * `cf-connecting-ip` is read first because **memovue.com is proxied through Cloudflare**, and
 * that changes who `x-real-ip` names. Railway's edge sets it to the remote address of the
 * connection it accepted, which is now a Cloudflare machine rather than a guest's phone — so
 * every visitor in the world collapsed into a handful of buckets. That is not a weak limit so
 * much as an actively harmful one: ten mistyped roll codes anywhere on earth spent the guess
 * budget for everybody, and the next real guest to scan a card off a table was told their
 * roll does not exist. Cloudflare overwrites `cf-connecting-ip` on every request it proxies,
 * so a client cannot choose it from the front.
 *
 * `x-real-ip` stays behind it for a deployment with nothing in front of Railway, where it is
 * the right answer, and "unknown" behind that: every caller shares one bucket, which is the
 * correct direction for this to fail — strict and immediately obvious.
 *
 * ponytail: `cf-connecting-ip` is trusted because the only public route in is through
 * Cloudflare — the service carries the custom domain and no Railway-generated one. Somebody
 * who found Railway's edge and sent it `Host: memovue.com` directly could forge the header
 * and mint a bucket per request. If that ever matters the fix is at the network, not here:
 * put the origin behind a Cloudflare Tunnel, or refuse requests that did not come through it.
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
