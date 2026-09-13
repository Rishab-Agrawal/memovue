/**
 * Guest cookie names and eviction. Apart from `auth.ts`, which is server-only, so the rule can
 * be tested without a request.
 */

/** One cookie per roll, so a guest can be in two at once. */
export const GUEST_COOKIE_PREFIX = "mv_g_";

export function guestCookieName(eventCode: string): string {
  return `${GUEST_COOKIE_PREFIX}${eventCode.toUpperCase()}`;
}

/**
 * How many rolls one browser carries a camera for. The cookies last 400 days and ride on every
 * request, so an unbounded jar would eventually exceed proxy header limits.
 */
const GUEST_COOKIE_LIMIT = 20;

/**
 * Which guest cookies to drop, oldest first, once a browser carries too many. `iat` is read
 * unverified: this only picks which of our cookies to evict, and an unparseable one goes first.
 */
export function staleGuestCookies(
  jar: { name: string; value: string }[],
  keep: string,
): string[] {
  const guests = jar
    .filter((cookie) => cookie.name.startsWith(GUEST_COOKIE_PREFIX) && cookie.name !== keep)
    .map((cookie) => ({ name: cookie.name, at: issuedAt(cookie.value) }));

  // One short of the limit, because `keep` has just been set and is not in this list.
  if (guests.length < GUEST_COOKIE_LIMIT) return [];

  guests.sort((a, b) => a.at - b.at);
  return guests.slice(0, guests.length - (GUEST_COOKIE_LIMIT - 1)).map((guest) => guest.name);
}

/** The `iat` out of a JWT payload, or 0 for anything that will not parse. */
function issuedAt(token: string): number {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as { iat?: unknown };
    return typeof payload.iat === "number" ? payload.iat : 0;
  } catch {
    return 0;
  }
}
