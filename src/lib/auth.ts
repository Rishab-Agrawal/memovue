import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { env } from "./env";

const secret = new TextEncoder().encode(env.authSecret);

const HOST_COOKIE = "mv_host";
const HOST_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
// Guests are asked for their name exactly once, so their session has to outlive the event
// by a wide margin — they come back weeks later to see the revealed album.
const GUEST_MAX_AGE = 60 * 60 * 24 * 400;

const cookieBase = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.isProduction,
  path: "/",
} as const;

/* ------------------------------------------------------------------ passwords */

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/* ------------------------------------------------------------------ host session */

export interface HostClaims {
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

export interface GuestClaims {
  guestId: string;
  eventId: string;
  tokenVersion: number;
}

/**
 * One cookie per event, so a guest can be in two events at once (a wedding and the
 * reception afterparty) without the sessions clobbering each other.
 */
export function guestCookieName(eventCode: string): string {
  return `mv_g_${eventCode.toUpperCase()}`;
}

export async function signGuestToken(guest: {
  id: string;
  eventId: string;
  tokenVersion: number;
}): Promise<string> {
  return new SignJWT({ ev: guest.eventId, tv: guest.tokenVersion })
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
    return {
      guestId: payload.sub,
      eventId: payload.ev,
      tokenVersion: Number(payload.tv ?? 0),
    };
  } catch {
    return null;
  }
}

export async function setGuestCookie(eventCode: string, token: string) {
  const jar = await cookies();
  jar.set(guestCookieName(eventCode), token, { ...cookieBase, maxAge: GUEST_MAX_AGE });
}

export async function readGuestClaims(eventCode: string): Promise<GuestClaims | null> {
  const jar = await cookies();
  const token = jar.get(guestCookieName(eventCode))?.value;
  if (!token) return null;
  return verifyGuestToken(token);
}
