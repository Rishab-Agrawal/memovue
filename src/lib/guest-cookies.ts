/**
 * What a guest's cookies are called, and which of them to let go of.
 *
 * Apart from `auth.ts` because that module reads `AUTH_SECRET` at import time and so drags
 * `server-only` with it. Nothing here is a secret or a signature — it is names and
 * arithmetic — and keeping it separate is what lets the eviction rule below be checked
 * without a request, the same way `roll-access` and `roll-config` are.
 */

/**
 * One cookie per event, so a guest can be in two events at once (a wedding and the
 * reception afterparty) without the sessions clobbering each other.
 */
export const GUEST_COOKIE_PREFIX = "mv_g_";

export function guestCookieName(eventCode: string): string {
  return `${GUEST_COOKIE_PREFIX}${eventCode.toUpperCase()}`;
}

/**
 * How many rolls one browser carries a camera for at once.
 *
 * These cookies never expire in any useful sense — four hundred days is the point, so that
 * somebody who joined a wedding still has their album by the next one — and there is one per
 * roll. They are also sent on every request to this origin, which for anybody sitting in an
 * album is three a minute. Twenty is far more events than a person attends in a year and
 * about five kilobytes of header; the alternative is a guest whose thirtieth roll pushes the
 * request past what a proxy will accept, and the symptom of that is the whole site refusing
 * them rather than one roll doing it.
 */
const GUEST_COOKIE_LIMIT = 20;

/**
 * Which guest cookies to drop, once a browser is carrying too many. Oldest first.
 *
 * Losing one is losing a camera in a roll joined a very long time ago: the photographs stay
 * in that album under the name that took them, and the phone can join it again.
 *
 * `iat` is read without verifying, deliberately — this decides which of our own cookies to
 * evict, not whether one is trusted. A tampered token is refused where it is used, by
 * `verifyGuestToken`, and one that will not parse here sorts as oldest and goes first, which
 * is the right answer for a value that can no longer name a camera anyway.
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
