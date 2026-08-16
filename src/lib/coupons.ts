import "server-only";

import { normalizeCode } from "./codes";
import { prisma } from "./prisma";

/**
 * Single-use codes that gate roll creation.
 *
 * This replaced the beta approval queue. With Google sign-in anyone can hold an account, so
 * gating accounts stopped being meaningful — the gate belongs on the act that costs us
 * storage and money, which is creating a roll.
 */

export class CouponError extends Error {}

/**
 * Claims a code for a user, atomically.
 *
 * `updateMany` with `redeemedAt: null` in the WHERE is the whole point: the database decides
 * the winner. Reading the row, checking it looks unused, and then writing it would let two
 * requests a millisecond apart both pass the check and both create a roll on one code.
 *
 * Returns the coupon id; the caller attaches it to the roll in the same transaction so a
 * code can never be spent without a roll to show for it.
 */
export async function claimCoupon(
  tx: Pick<typeof prisma, "coupon">,
  code: string,
  userId: string,
): Promise<string> {
  const normalized = normalizeCode(code);
  if (!normalized) throw new CouponError("Enter your coupon code.");

  const claimed = await tx.coupon.updateMany({
    where: { code: normalized, redeemedAt: null },
    data: { redeemedAt: new Date(), redeemedById: userId },
  });

  if (claimed.count === 0) {
    // Deliberately one message for "no such code" and "already spent". Distinguishing them
    // turns the field into an oracle for guessing valid codes.
    throw new CouponError("That code isn't valid or has already been used.");
  }

  const coupon = await tx.coupon.findUnique({
    where: { code: normalized },
    select: { id: true },
  });
  if (!coupon) throw new CouponError("That code isn't valid or has already been used.");

  return coupon.id;
}

export async function mintCoupons(count: number, note?: string): Promise<string[]> {
  const { inviteCode } = await import("./codes");
  const codes = Array.from({ length: count }, () => inviteCode());

  await prisma.coupon.createMany({
    data: codes.map((code) => ({ code, note: note || null })),
    skipDuplicates: true,
  });

  return codes;
}

export async function listCoupons() {
  return prisma.coupon.findMany({
    orderBy: [{ redeemedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    select: {
      id: true,
      code: true,
      note: true,
      redeemedAt: true,
      createdAt: true,
      redeemedBy: { select: { name: true, email: true } },
      roll: { select: { id: true, name: true } },
    },
  });
}
