import "server-only";

import { verifyGuestToken } from "./auth";
import { prisma } from "./prisma";

/**
 * Attaches anonymous guest sessions to an account at sign-in, the only moment both are on the
 * same request. Takes tokens rather than reading cookies, so it can be tested without a browser.
 * A row already attached to an account is never taken. Returns how many were linked.
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

  // The token must name the roll its row is in, so one event's cookie cannot claim another's guest.
  const live = rows.filter((row) =>
    claims.some((claim) => claim.guestId === row.id && claim.eventId === row.rollId),
  );

  if (live.length === 0) return 0;

  // Rolls this account is already in; it keeps that row.
  const already = await prisma.guest.findMany({
    where: { userId, rollId: { in: live.map((row) => row.rollId) } },
    select: { rollId: true },
  });

  // At most one row per roll, because `Guest` is unique on `[rollId, userId]`.
  const taken = new Set(already.map((row) => row.rollId));
  let linked = 0;

  for (const row of live) {
    if (taken.has(row.rollId)) continue;
    taken.add(row.rollId);

    // `userId: null` again, in case another tab's sign-in claimed it since the read.
    const claimed = await prisma.guest.updateMany({
      where: { id: row.id, userId: null },
      data: { userId },
    });
    linked += claimed.count;
  }

  return linked;
}
