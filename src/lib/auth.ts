import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { env } from "./env";
import { guestCookieName, staleGuestCookies } from "./guest-cookies";

const secret = new TextEncoder().encode(env.authSecret);

const HOST_COOKIE = "mv_host";
const OAUTH_STATE_COOKIE = "mv_oauth_state";
const HOST_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
// This cookie is not a convenience, it *is* the guest — there is nothing else in the product
// that knows which camera is theirs. So it outlives the event by a wide margin: they come
// back weeks later for the revealed album, and an expiry in between would read as a roll that
// had lost their photographs. A year and a bit, the ceiling browsers will store.
const GUEST_MAX_AGE = 60 * 60 * 24 * 400;

const cookieBase = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.isProduction,
  path: "/",
} as const;

/* ------------------------------------------------------------------ oauth state */

/**
 * CSRF protection for the Google round trip.
 *
 * The cookie is the secret: Google echoes `state` back on the callback, and if it does not
 * match what we set, the request did not start here. Without this the callback is an open
 * login endpoint — anyone could hand a victim a link that signs them into an account the
 * attacker controls.
 */
export async function startOAuthState(next?: string): Promise<string> {
  const state = crypto.randomUUID();
  const jar = await cookies();

  /*
    Where to land afterwards rides in this cookie rather than in `state`, which Google echoes
    back from the open internet and which anyone can therefore choose. The caller has already
    checked it is a path on this site; keeping it out of `state` is what stops it being
    swapped for one that is not.
  */
  jar.set(OAUTH_STATE_COOKIE, next ? `${state} ${next}` : state, {
    ...cookieBase,
    maxAge: 60 * 10,
  });
  return state;
}

/** Single use: the cookie is cleared whether or not it matched. */
export async function consumeOAuthState(
  returned: string | null,
): Promise<{ ok: boolean; next?: string }> {
  const jar = await cookies();
  const [expected, next] = (jar.get(OAUTH_STATE_COOKIE)?.value ?? "").split(" ");
  jar.delete(OAUTH_STATE_COOKIE);
  return { ok: Boolean(expected && returned && expected === returned), next };
}

/* ------------------------------------------------------------------ host session */

interface HostClaims {
  userId: string;
  tokenVersion: number;
}

export async function createHostSession(user: { id: string; tokenVersion: number }) {
  const token = await new SignJWT({ tv: user.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${HOST_MAX_AGE}s`)
    .sign(secret);

  const jar = await cookies();
  jar.set(HOST_COOKIE, token, { ...cookieBase, maxAge: HOST_MAX_AGE });
}

export async function clearHostSession() {
  const jar = await cookies();
  jar.delete(HOST_COOKIE);
}

/**
 * Reads the host cookie and validates the signature only — the caller still has to
 * confirm `tokenVersion` against the database, which is what makes password changes
 * actually revoke old sessions.
 */
export async function readHostClaims(): Promise<HostClaims | null> {
  const jar = await cookies();
  const token = jar.get(HOST_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    return { userId: payload.sub, tokenVersion: Number(payload.tv ?? 0) };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ guest session */

interface GuestClaims {
  guestId: string;
  eventId: string;
}

export async function signGuestToken(guest: { id: string; eventId: string }): Promise<string> {
  return new SignJWT({ ev: guest.eventId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(guest.id)
    .setIssuedAt()
    .setExpirationTime(`${GUEST_MAX_AGE}s`)
    .sign(secret);
}

export async function verifyGuestToken(token: string): Promise<GuestClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub || typeof payload.ev !== "string") return null;
    return { guestId: payload.sub, eventId: payload.ev };
  } catch {
    return null;
  }
}

export async function setGuestCookie(eventCode: string, token: string) {
  const jar = await cookies();
  const name = guestCookieName(eventCode);

  jar.set(name, token, { ...cookieBase, maxAge: GUEST_MAX_AGE });
  for (const stale of staleGuestCookies(jar.getAll(), name)) jar.delete(stale);
}

export async function readGuestClaims(eventCode: string): Promise<GuestClaims | null> {
  const jar = await cookies();
  const token = jar.get(guestCookieName(eventCode))?.value;
  if (!token) return null;
  return verifyGuestToken(token);
}
