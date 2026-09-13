import { cookies } from "next/headers";
import { after } from "next/server";

import { consumeOAuthState, createHostSession } from "@/lib/auth";
import { GUEST_COOKIE_PREFIX } from "@/lib/guest-cookies";
import { env } from "@/lib/env";
import { exchangeCode, verifyIdToken } from "@/lib/google";
import { linkGuestSessions } from "@/lib/guest-link";
import { prisma } from "@/lib/prisma";
import { OAUTH_LIMIT, OAUTH_WINDOW_SECONDS, clientIp, rateLimit } from "@/lib/ratelimit";
import { notify } from "@/lib/telegram";

export const dynamic = "force-dynamic";

function back(reason: string) {
  return Response.redirect(`${env.appUrl}/welcome?error=${reason}`, 307);
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  // Shares the budget with `/start`, before anything here is spent: the state check below is
  // cheap, but past it this route calls Google and writes a user row.
  if (!rateLimit(`oauth:${clientIp(request)}`, OAUTH_LIMIT, OAUTH_WINDOW_SECONDS).ok) {
    return back("too_many");
  }

  // Google reports user-side refusals here rather than by failing the request.
  if (url.searchParams.get("error")) return back("declined");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) return back("no_code");

  // Before the code exchange: a callback that did not start here is not worth a call to Google.
  const started = await consumeOAuthState(state);
  if (!started.ok) return back("bad_state");

  let identity;
  try {
    identity = await verifyIdToken(await exchangeCode(code));
  } catch {
    return back("verification_failed");
  }

  // By googleId, or by email so a row created before its first sign-in adopts the identity.
  const existing = await prisma.user.findFirst({
    where: { OR: [{ googleId: identity.googleId }, { email: identity.email }] },
    select: { id: true, tokenVersion: true, role: true, name: true },
  });

  const shouldBeAdmin = env.adminEmail !== "" && identity.email === env.adminEmail;

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          googleId: identity.googleId,
          avatarUrl: identity.avatarUrl,
          // Never overwrite a name the host has since edited with Google's version.
          name: existing.name || identity.name,
          ...(shouldBeAdmin && existing.role !== "ADMIN" ? { role: "ADMIN" as const } : {}),
        },
        select: { id: true, tokenVersion: true },
      })
    : await prisma.user.create({
        data: {
          googleId: identity.googleId,
          email: identity.email,
          name: identity.name,
          avatarUrl: identity.avatarUrl,
          role: shouldBeAdmin ? "ADMIN" : "HOST",
        },
        select: { id: true, tokenVersion: true },
      });

  await createHostSession(user);

  // A new host is worth a signal. `after`, so sign-in does not wait on Telegram.
  if (!existing) {
    after(() => notify("signals", `New host — ${identity.name} · ${identity.email}`));
  }

  // Rolls this browser joined anonymously now belong to the account. Best effort: never fails the sign-in.
  try {
    const jar = await cookies();
    await linkGuestSessions(
      user.id,
      jar
        .getAll()
        .filter((cookie) => cookie.name.startsWith(GUEST_COOKIE_PREFIX))
        .map((cookie) => cookie.value),
    );
  } catch {
    // The roll just stays anonymous.
  }

  return Response.redirect(`${env.appUrl}${started.next ?? "/rolls"}`, 307);
}
