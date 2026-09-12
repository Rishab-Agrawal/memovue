"use server";

import { getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { poolFrom, poolMoves } from "@/lib/roll-config";

/**
 * Which of the three things a guest can do with the pool. They were one signed number until
 * the refill ceilings arrived, and then they could not be: drawing a refill spends one of a
 * lifetime ten and answers to the event clock, while reclaiming film you gave away spends
 * nothing and answers to neither. Told apart by the caller, because the caller is a button
 * and already knows which one was pressed.
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
      /**
       * What they could draw the *next* time they run dry, which is not `take`.
       *
       * `take` is the ceiling as things stand, and standing right after a refill means a full
       * camera and therefore zero. The camera needs the other number — whether there is a
       * refill left at all — or a guest who topped up once would never be offered a second.
       */
      refill: number;
    }
  | { ok: false; error: string };

/**
 * Moves film between one guest and the roll's pool.
 *
 * `shots` is always a positive count; `kind` says which way it goes and which ceiling it has
 * to fit under. One action for all three, because they are one rule read from three
 * directions and a second entry point would be a second copy of every check below.
 */
export async function movePool(code: string, kind: PoolMove, shots: number): Promise<PoolResult> {
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

    // Clamped rather than refused: the ceilings move under an open dialog — the pool drains,
    // the event crosses a quarter of the way through — and a guest asking for one more than
    // is there meant it.
    const moving = Math.min(Math.max(0, Math.trunc(shots)), moves[kind]);
    if (moving === 0) return null;

    // Out of the pool for two of the three, into it for the other. Every figure below is the
    // same arithmetic, so it is written once.
    const delta = kind === "give" ? -moving : moving;

    await tx.guest.update({
      where: { id: guest.id },
      data: {
        fromPool: mine.fromPool + delta,
        // Only a draw on the shared half is a refill. Taking back what you gave is not one,
        // and spending a lifetime ten on undoing your own generosity would be a trap.
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
