"use server";

import { getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { poolFrom, poolMoves } from "@/lib/roll-config";

/**
 * Which way film moves. Separate kinds because a refill (`take`) spends one of a lifetime ten and
 * answers to the clock, while reclaiming a gift (`back`) answers to neither.
 */
export type PoolMove = "take" | "give" | "back";

export type PoolResult =
  | {
      ok: true;
      /** How many actually moved after clamping, which is rarely what was asked. */
      moved: number;
      pool: number;
      shotsLeft: number;
      take: number;
      give: number;
      back: number;
      /** What they could draw the next time they run dry. Not `take`, which is zero on a full camera. */
      refill: number;
    }
  | { ok: false; error: string };

/** Moves film between one guest and the roll's pool. `shots` is a positive count; `kind` is the direction. */
export async function movePool(code: string, kind: PoolMove, shots: number): Promise<PoolResult> {
  const context = await getGuestContext(code);
  if (!context) return { ok: false, error: "You are not in this roll." };
  if (!context.capturing) return { ok: false, error: "This roll has finished shooting." };

  if (!rateLimit(`pool:${context.guest.id}`, 30, 60).ok) {
    return { ok: false, error: "Too many changes at once. Try again in a minute." };
  }

  const { roll, guest } = context;

  /*
    The pool is a sum across guests, so read-then-write races: two guests taking the last ten
    frames at once would both succeed. Locking the roll row makes read, decision and write one
    step per roll, and everything the decision uses is re-read inside the lock.
  */
  const moved = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "Roll" WHERE id = ${roll.id} FOR UPDATE`;

    const mine = await tx.guest.findUnique({
      where: { id: guest.id },
      select: { fromPool: true, refills: true },
    });
    if (!mine) return null;

    // In-flight uploads count, the same as everywhere else that asks what a guest has left.
    const used = await tx.photo.count({ where: { guestId: guest.id } });
    const { _count, _sum } = await tx.guest.aggregate({
      where: { rollId: roll.id },
      _count: true,
      _sum: { fromPool: true },
    });

    const pool = poolFrom(roll, _count, _sum.fromPool ?? 0);
    const shotsLeft = Math.max(0, roll.photosPerGuest + mine.fromPool - used);
    const moves = poolMoves(roll, { ...mine, shotsLeft }, pool);

    // Clamped rather than refused: the ceilings move under an open dialog.
    const moving = Math.min(Math.max(0, Math.trunc(shots)), moves[kind]);
    if (moving === 0) return null;

    const delta = kind === "give" ? -moving : moving;

    await tx.guest.update({
      where: { id: guest.id },
      data: {
        fromPool: mine.fromPool + delta,
        // Only a draw on the shared half is a refill; taking back your own gift is not.
        ...(kind === "take" ? { refills: { increment: 1 } } : {}),
      },
    });

    const fromPool = mine.fromPool + delta;
    const refills = mine.refills + (kind === "take" ? 1 : 0);
    const rest = pool - delta;
    const left = Math.max(0, shotsLeft + delta);
    return {
      moved: moving,
      pool: rest,
      shotsLeft: left,
      ...poolMoves(roll, { fromPool, refills, shotsLeft: left }, rest),
      refill: poolMoves(roll, { fromPool, refills, shotsLeft: 0 }, rest).take,
    };
  });

  if (!moved) return { ok: false, error: "There is nothing to move right now." };
  return { ok: true, ...moved };
}
