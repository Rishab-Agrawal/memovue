"use server";

import { getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { poolMoves } from "@/lib/roll-config";
import { poolLeft } from "@/lib/rolls";

export type PoolResult =
  /** `moved` is what was actually applied after clamping, which is rarely what was asked. */
  | { ok: true; moved: number; pool: number; shotsLeft: number; take: number; give: number }
  | { ok: false; error: string };

/**
 * Moves film between one guest and the roll's pool. Positive draws out, negative hands back.
 *
 * One action for both directions because they are one rule read from either end — a second
 * entry point would be a second copy of every check below, and the two would drift the first
 * time the ceiling moved.
 */
export async function movePool(code: string, delta: number): Promise<PoolResult> {
  const context = await getGuestContext(code);
  if (!context) return { ok: false, error: "You are not in this roll." };
  // Film that cannot be spent is not worth moving, and the pool screen is gone by then anyway.
  if (!context.capturing) return { ok: false, error: "This roll has finished shooting." };

  if (!rateLimit(`pool:${context.guest.id}`, 30, 60).ok) {
    return { ok: false, error: "Too many changes at once. Try again in a minute." };
  }

  const { roll, guest, shotsLeft } = context;
  const pool = await poolLeft(roll);
  const moves = poolMoves(roll, { fromPool: guest.fromPool, shotsLeft }, pool);

  // Clamped rather than refused: the ceilings move under an open dialog, and a guest asking
  // for one more than is there meant it.
  const wanted = Math.trunc(delta);
  const moving = wanted > 0 ? Math.min(wanted, moves.take) : Math.max(wanted, -moves.give);
  if (moving === 0) return { ok: false, error: "There is nothing to move right now." };

  /*
    Compare-and-swap on the row this guest just read, so a double tap — or the same person on
    two tabs — cannot spend one allowance twice.

    ponytail: the pool itself is read a line above and never locked, so two guests taking the
    last of it in the same instant can between them draw a roll a few frames over its size.
    Per-guest quotas still hold, which is what the reserve route enforces on every upload.
    Lock the roll row on the day a pool running dry is worth a transaction.
  */
  const moved = await prisma.guest.updateMany({
    where: { id: guest.id, fromPool: guest.fromPool },
    data: { fromPool: guest.fromPool + moving },
  });
  if (moved.count === 0) return { ok: false, error: "Your shots changed. Try that again." };

  const fromPool = guest.fromPool + moving;
  const left = Math.max(0, shotsLeft + moving);
  const rest = Math.max(0, pool - moving);
  return {
    ok: true,
    moved: moving,
    pool: rest,
    shotsLeft: left,
    ...poolMoves(roll, { fromPool, shotsLeft: left }, rest),
  };
}
