import "server-only";

import { readGuestClaims } from "./auth";
import { normalizeCode } from "./codes";
import { prisma } from "./prisma";
import { type RollPhase, acceptsUploads, isCapturing, isOpen, rollPhase } from "./roll-access";
import { getCurrentUser } from "./session";

export interface GuestContext {
  roll: NonNullable<Awaited<ReturnType<typeof findRoll>>>;
  guest: { id: string; name: string; userId: string | null };
  phase: RollPhase;
  /** Whether photographs in this roll are legible yet. */
  open: boolean;
  /** Whether the shutter still works. */
  capturing: boolean;
  /** Whether bytes captured earlier may still be uploaded. Outlives `capturing`. */
  acceptsUploads: boolean;
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

const guestFields = {
  id: true,
  name: true,
  rollId: true,
  userId: true,
  tokenVersion: true,
} as const;

/**
 * Resolves whoever is holding this roll's camera, by cookie or by account.
 *
 * The cookie is the original credential and still the common case — most guests never sign
 * in, and a cookie is all they have. But a guest who *does* have an account is identified by
 * something better than a cookie, and falling back to it is what makes an account worth
 * having: the same person on a second phone, or after clearing their browser, walks back into
 * the roll they already joined instead of being asked to prove it by re-typing a name that
 * the roll will tell them is already taken.
 *
 * `tokenVersion` is checked on the cookie path so reclaiming a name signs the old device out
 * — one active session per anonymous guest, which makes a hijack immediately obvious to
 * whoever actually owns the name. The account path has no token to check because the account
 * session *is* the credential, and a stronger one.
 */
export async function getGuestContext(code: string): Promise<GuestContext | null> {
  const roll = await findRoll(code);
  if (!roll) return null;

  let guest: { id: string; name: string; rollId: string; userId: string | null } | null = null;

  const claims = await readGuestClaims(roll.code);
  if (claims && claims.eventId === roll.id) {
    const found = await prisma.guest.findUnique({
      where: { id: claims.guestId },
      select: guestFields,
    });
    if (found && found.rollId === roll.id && found.tokenVersion === claims.tokenVersion) {
      guest = found;
    }
  }

  if (!guest) {
    const user = await getCurrentUser();
    if (user) {
      guest = await prisma.guest.findFirst({
        where: { rollId: roll.id, userId: user.id },
        select: guestFields,
      });
    }
  }

  if (!guest) return null;

  // In-flight uploads count against the quota too, otherwise a guest could hold the shutter
  // down and issue far more upload URLs than they are entitled to.
  const shotsUsed = await prisma.photo.count({ where: { guestId: guest.id } });

  return {
    roll,
    guest: { id: guest.id, name: guest.name, userId: guest.userId },
    phase: rollPhase(roll),
    open: isOpen(roll),
    capturing: isCapturing(roll),
    acceptsUploads: acceptsUploads(roll),
    shotsUsed,
    shotsLeft: Math.max(0, roll.photosPerGuest - shotsUsed),
  };
}
