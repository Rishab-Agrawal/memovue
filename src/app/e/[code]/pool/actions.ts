"use server";

import { getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { poolFrom, poolMoves } from "@/lib/roll-config";

export type PoolResult =
  /** `moved` is what was actually applied after clamping, which is rarely what was asked. */
  | { ok: true; moved: number; pool: number; shotsLeft: number; take: number; give: number; back: number }
  | { ok: false; error: string };

/**
 * Moves film between one guest and the roll's pool. Positive draws out, negative hands back.
 *
 * One action for all three moves — take, give, take back — because they are one rule read
 * from three directions, and a second entry point would be a second copy of every check
 * below. Which of the three a positive number is does not have to be declared: the two
 * positive ceilings are computed together and the larger one applies, so a guest who has run
 * dry can draw their top-up and a guest reclaiming a gift can reclaim it, and neither can
 * exceed what the rules allow them separately.
 */
export async function movePool(code: string, delta: number): Promise<PoolResult> {
  const context = await getGuestContext(code);
  if (!context) return { ok: false, error: "You are not in this roll." };
  // Film that cannot be spent is not worth moving, and the pool screen is gone by then anyway.
  if (!context.capturing) return { ok: false, error: "This roll has finished shooting." };

  if (!rateLimit(`pool:${context.guest.id}`, 30, 60).ok) {
    return { ok: false, error: "Too many changes at once. Try again in a minute." };
  }

  const { roll, guest } = context;

  /*
    Every move on one roll's pool, in a queue of one.

    The pool is a sum over the roll's guests, so reading it and then writing against it is a
    read-modify-write across rows — and two guests taking the last ten frames in the same
    instant both read ten, both passed, and the roll quietly went twenty over its size. Worse,
    it went over silently: the display floors at zero, so nothing anywhere said so.

    The roll's own row is the turnstile. It is not read for its contents — everything below
    comes from `roll`, loaded before the lock — it is held so that the aggregate, the decision
    and the write are one indivisible step per roll. Contention is a handful of taps at a
    party, and it is scoped to the roll, so two events never wait on each other.

    Everything the decision rests on is re-read inside it. The counts from `getGuestContext`
    were taken outside the lock and are exactly the numbers this exists to stop trusting.
  */
  const moved = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "Roll" WHERE id = ${roll.id} FOR UPDATE`;

    const mine = await tx.guest.findUnique({
      where: { id: guest.id },
      select: { fromPool: true },
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
    const moves = poolMoves(roll, { fromPool: mine.fromPool, shotsLeft }, pool);

    // Clamped rather than refused: the ceilings move under an open dialog, and a guest asking
    // for one more than is there meant it.
    const wanted = Math.trunc(delta);
    const moving =
      wanted > 0
        ? Math.min(wanted, Math.max(moves.take, moves.back))
        : Math.max(wanted, -moves.give);
    if (moving === 0) return null;

    await tx.guest.update({
      where: { id: guest.id },
      data: { fromPool: mine.fromPool + moving },
    });

    const rest = pool - moving;
    const left = Math.max(0, shotsLeft + moving);
    return {
      moved: moving,
      pool: rest,
      shotsLeft: left,
      ...poolMoves(roll, { fromPool: mine.fromPool + moving, shotsLeft: left }, rest),
    };
  });

  if (!moved) return { ok: false, error: "There is nothing to move right now." };
  return { ok: true, ...moved };
}
