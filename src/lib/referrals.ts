import "server-only";

import { normalizeCode } from "./codes";
import { REFERRALS } from "./constants";
import { prisma } from "./prisma";

/**
 * Wedding businesses that send hosts here.
 *
 * A code is resolved in exactly two places — the wizard's first step, which refuses one that
 * does not exist, and roll creation, which is the trust boundary and asks again. Everything
 * else reads the roll's `referrerId`.
 *
 * Codes are normalised the way a roll code is, so "bloom-events" and "BLOOM EVENTS" are the
 * same code however it was written on whatever the business handed the host.
 */

/** What the card on the roll screen draws. */
export interface Sponsor {
  name: string;
  url: string | null;
  logoUrl: string | null;
}

const card = { name: true, url: true, logoUrl: true } as const;

/** The business behind a typed code, or null for anything that is not one. */
export async function findReferrer(input: string) {
  const code = normalizeCode(input);
  if (!code) return null;

  return prisma.referrer.findUnique({ where: { code }, select: { id: true, ...card } });
}

/**
 * The business to credit on one roll's home screen. Null costs no query, so a roll created
 * without a code — which is most of them — pays nothing for this.
 */
export async function sponsorFor(roll: { referrerId: string | null }): Promise<Sponsor | null> {
  if (!REFERRALS || !roll.referrerId) return null;
  return prisma.referrer.findUnique({ where: { id: roll.referrerId }, select: card });
}

/* ------------------------------------------------------------------ admin */

/** The list, newest first, each with how many rolls its code has created. */
export function listReferrers() {
  return prisma.referrer.findMany({
    orderBy: { createdAt: "desc" },
    select: { ...card, id: true, code: true, _count: { select: { rolls: true } } },
  });
}

/**
 * Adds a business. Returns false when the code is already taken, which is the one failure an
 * admin can act on — every other field is theirs to type.
 */
export async function addReferrer(input: {
  code: string;
  name: string;
  url?: string;
  logoUrl?: string;
}): Promise<boolean> {
  const { count } = await prisma.referrer.createMany({
    data: [
      {
        code: normalizeCode(input.code),
        name: input.name,
        url: input.url || null,
        logoUrl: input.logoUrl || null,
      },
    ],
    skipDuplicates: true,
  });
  return count > 0;
}

/**
 * Retires a code. Rolls that used it keep their row and lose the credit — `onDelete: SetNull`,
 * because a roll outliving the business that sold it is not a reason to delete somebody's album.
 */
export function removeReferrer(id: string) {
  return prisma.referrer.deleteMany({ where: { id } });
}

/** Businesses whose codes created a roll in the given window. What the digest names. */
export async function referredSince(from: Date, to: Date) {
  const businesses = await prisma.referrer.findMany({
    select: {
      name: true,
      _count: { select: { rolls: { where: { createdAt: { gte: from, lt: to } } } } },
    },
  });

  return businesses
    .filter((business) => business._count.rolls > 0)
    .sort((a, b) => b._count.rolls - a._count.rolls)
    .map((business) => ({ name: business.name, rolls: business._count.rolls }));
}
