import "server-only";

import { verifyGuestToken } from "./auth";
import { prisma } from "./prisma";

/**
 * Attaches anonymous guest sessions to an account.
 *
 * The privacy policy already promises this — "if you later choose to create one, the rolls
 * you joined become linked to it" — and the banner inside every album invites people to do
 * exactly that. Signing in is the only moment it can be honoured: the guest cookies are on
 * that request, and nothing anywhere else records that they belong to the same person.
 *
 * Takes the tokens rather than reading the cookie jar itself, so the rules below can be
 * exercised against a real database without a browser and a Google round trip.
 *
 * One guard, and it matters: a row already attached to an account is never taken — that would
 * be one person's sign-in silently claiming another's identity in a roll.
 *
 * Returns how many were linked.
 */
export async function linkGuestSessions(userId: string, tokens: string[]): Promise<number> {
  if (tokens.length === 0) return 0;

  const verified = await Promise.all(tokens.map((token) => verifyGuestToken(token)));
  const claims = verified.filter((claim) => claim !== null);
  if (claims.length === 0) return 0;

  const rows = await prisma.guest.findMany({
    where: { id: { in: claims.map((claim) => claim.guestId) }, userId: null },
    select: { id: true, rollId: true },
  });

  // The token has to name the roll its row is actually in, so a cookie minted for one event
  // cannot hand over a guest in another.
  const live = rows.filter((row) =>
    claims.some((claim) => claim.guestId === row.id && claim.eventId === row.rollId),
  );

  if (live.length === 0) return 0;

  // Rolls this account is already in under its own name. Linking a second row there would
  // break the one-identity-per-roll constraint, and the row it already has is the better one.
  const already = await prisma.guest.findMany({
    where: { userId, rollId: { in: live.map((row) => row.rollId) } },
    select: { rollId: true },
  });

  /*
    One roll at a time, and at most one row per roll.

    `Guest` is unique on `[rollId, userId]`, so a browser carrying two anonymous cookies for
    the same roll would fail the whole write if these went in a single statement. Taking the
    first and leaving the rest anonymous loses nothing — the photographs stay where they are
    either way.
  */
  const taken = new Set(already.map((row) => row.rollId));
  let linked = 0;

  for (const row of live) {
    if (taken.has(row.rollId)) continue;
    taken.add(row.rollId);

    // `userId: null` again in the WHERE: between the read above and this write, a sign-in in
    // another tab could have claimed the same row.
    const claimed = await prisma.guest.updateMany({
      where: { id: row.id, userId: null },
      data: { userId },
    });
    linked += claimed.count;
  }

  return linked;
}
