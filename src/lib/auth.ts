import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { env } from "./env";
import { guestCookieName, staleGuestCookies } from "./guest-cookies";

const secret = new TextEncoder().encode(env.authSecret);

const HOST_COOKIE = "mv_host";
const OAUTH_STATE_COOKIE = "mv_oauth_state";
const HOST_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
// The guest cookie is the guest's whole identity, and they return weeks later for the album,
// so it lasts 400 days — the most browsers will store.
const GUEST_MAX_AGE = 60 * 60 * 24 * 400;

const cookieBase = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.isProduction,
  path: "/",
} as const;

/* ------------------------------------------------------------------ oauth state */

/**
 * CSRF protection for the Google round trip: the callback's `state` must match this cookie, or
 * anyone could sign a victim into an attacker's account.
 */
export async function startOAuthState(next?: string): Promise<string> {
  const state = crypto.randomUUID();
  const jar = await cookies();

  // `next` rides in the cookie, not in `state`, which comes back from the open internet.
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
 * Reads the host cookie and validates the signature only. The caller checks `tokenVersion`
 * against the database, which is what makes "sign out everywhere" revoke old sessions.
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
