import { cookies } from "next/headers";
import { after } from "next/server";

import { GUEST_COOKIE_PREFIX, consumeOAuthState, createHostSession } from "@/lib/auth";
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

  // Checked before anything is spent on the code exchange: a callback that did not start
  // here is not worth talking to Google about.
  if (!(await consumeOAuthState(state))) return back("bad_state");

  let identity;
  try {
    identity = await verifyIdToken(await exchangeCode(code));
  } catch {
    return back("verification_failed");
  }

  /*
    Matched on googleId first, then on email.

    The email fallback is what lets an account that predates Google sign-in adopt its Google
    identity instead of quietly becoming a second account with the same address — which is
    how the existing admin keeps its rolls and its role.
  */
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

  /*
    The pulse. A host signing up for the first time is the rarest event this app has and the
    only one that means the product grew, so it is worth a line on a phone — and it is a fact
    no query can reconstruct later with the same weight as knowing it on the day.
    `after`, because nobody signing in should wait on Telegram to see their rolls.
  */
  if (!existing) {
    after(() => notify("signals", `New host — ${identity.name} · ${identity.email}`));
  }

  /*
    Any rolls this browser joined anonymously now belong to the account.

    Wrapped, because it is a courtesy and not a credential: a failure here must not turn a
    successful sign-in into an error screen. The worst case is that a roll stays anonymous,
    which is exactly where it was a moment ago.
  */
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
    // Nothing to do about it here, and nothing the person signing in can act on.
  }

  return Response.redirect(`${env.appUrl}/rolls`, 307);
}
