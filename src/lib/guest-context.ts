import "server-only";

import { readGuestClaims } from "./auth";
import { normalizeCode } from "./codes";
import { prisma } from "./prisma";
import { type RollPhase, isCapturing, isOpen, rollPhase } from "./roll-access";

export interface GuestContext {
  roll: NonNullable<Awaited<ReturnType<typeof findRoll>>>;
  guest: { id: string; name: string };
  phase: RollPhase;
  /** Whether photographs in this roll are legible yet. */
  open: boolean;
  /** Whether the shutter still works. */
  capturing: boolean;
  shotsUsed: number;
  shotsLeft: number;
}

function findRoll(code: string) {
  return prisma.roll.findUnique({
    where: { code: normalizeCode(code) },
    include: { host: { select: { name: true } } },
  });
}

export async function getRollByJoinCode(code: string) {
  return findRoll(code);
}

/**
 * Resolves the signed guest cookie into a live guest, or null.
 *
 * `tokenVersion` is checked so reclaiming a name on a new device silently signs the old
 * device out — one active session per guest, which makes a hijack immediately obvious to
 * whoever actually owns the name.
 */
export async function getGuestContext(code: string): Promise<GuestContext | null> {
  const roll = await findRoll(code);
  if (!roll) return null;

  const claims = await readGuestClaims(roll.code);
  if (!claims || claims.eventId !== roll.id) return null;

  const guest = await prisma.guest.findUnique({
    where: { id: claims.guestId },
    select: { id: true, name: true, rollId: true, tokenVersion: true },
  });
  if (!guest || guest.rollId !== roll.id || guest.tokenVersion !== claims.tokenVersion) {
    return null;
  }

  // In-flight uploads count against the quota too, otherwise a guest could hold the shutter
  // down and issue far more upload URLs than they are entitled to.
  const shotsUsed = await prisma.photo.count({ where: { guestId: guest.id } });

  return {
    roll,
    guest: { id: guest.id, name: guest.name },
    phase: rollPhase(roll),
    open: isOpen(roll),
    capturing: isCapturing(roll),
    shotsUsed,
    shotsLeft: Math.max(0, roll.photosPerGuest - shotsUsed),
  };
}
