import "server-only";

import { createRemoteJWKSet, jwtVerify } from "jose";

import { env } from "./env";

/**
 * Google sign-in, by hand: only the OIDC handshake is needed, since sessions are our own. An
 * auth library would bring its own session model and tables to replace about a hundred lines.
 */

const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/** Google issues `iss` in both forms depending on the flow; both are legitimate. */
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

interface GoogleIdentity {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

function config() {
  if (!env.google) {
    throw new Error(
      "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    );
  }
  return env.google;
}

export function isConfigured(): boolean {
  return env.google !== null;
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = config();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    // Without this, a browser already signed into one Google account silently reuses it,
    // which makes "sign in as someone else" impossible to reach.
    prompt: "select_account",
  });

  return `${AUTHORIZE}?${params}`;
}

/**
 * Swaps the one-time code for tokens. Only the `id_token` is used — we want identity, not
 * access to anything, so the access token is discarded rather than stored.
 */
export async function exchangeCode(code: string): Promise<string> {
  const { clientId, clientSecret, redirectUri } = config();

  const response = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google rejected the code exchange (${response.status}).`);
  }

  const payload = (await response.json()) as { id_token?: string };
  if (!payload.id_token) throw new Error("Google returned no id_token.");
  return payload.id_token;
}

/**
 * Verifies the token's signature against Google's published keys and checks that it was
 * issued for us. Skipping this and trusting the payload would let anyone mint an identity.
 */
export async function verifyIdToken(idToken: string): Promise<GoogleIdentity> {
  const { clientId } = config();

  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ISSUERS,
    audience: clientId,
  });

  const email = typeof payload.email === "string" ? payload.email.toLowerCase().trim() : "";
  if (!email) throw new Error("Google returned no email address.");

  // An unverified address could belong to someone else, which would let a stranger take
  // over an account by claiming its email.
  if (payload.email_verified !== true) {
    throw new Error("That Google account's email address is not verified.");
  }

  if (typeof payload.sub !== "string") throw new Error("Google returned no subject claim.");

  return {
    googleId: payload.sub,
    email,
    name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email,
    avatarUrl: typeof payload.picture === "string" ? payload.picture : null,
  };
}
