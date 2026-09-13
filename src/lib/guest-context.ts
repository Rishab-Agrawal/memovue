import "server-only";

import { readGuestClaims } from "./auth";
import { normalizeCode } from "./codes";
import { prisma } from "./prisma";
import { type RollPhase, acceptsUploads, isCapturing, isOpen, rollPhase } from "./roll-access";
import { getCurrentUser } from "./session";

const guestFields = {
  id: true,
  name: true,
  rollId: true,
  userId: true,
  fromPool: true,
  refills: true,
} as const;

type GuestRow = {
  id: string;
  name: string;
  rollId: string;
  userId: string | null;
  fromPool: number;
  refills: number;
};

interface GuestContext {
  roll: NonNullable<Awaited<ReturnType<typeof getRollByJoinCode>>>;
  guest: GuestRow;
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

export function getRollByJoinCode(code: string) {
  return prisma.roll.findUnique({
    where: { code: normalizeCode(code) },
    include: { host: { select: { name: true } } },
  });
}

/** Enough of a roll to work out where its screens are. */
type Located = { id: string; code: string; hostId: string };

/** The roll's own screen for whoever holds its camera: the host screen, or the guest album. */
export async function rollHome(roll: Located): Promise<string> {
  const user = await getCurrentUser();
  return user?.id === roll.hostId ? `/rolls/${roll.id}` : `/e/${roll.code}/album`;
}

/** Out of the roll to your list of rolls. Null for a guest with no account: there is no list. */
export async function guestHome(roll: Located): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return user.id === roll.hostId ? `/rolls/${roll.id}` : "/rolls";
}

/**
 * Resolves whoever is holding this roll's camera, by cookie or by account.
 *
 * The cookie is the credential; the name is only a caption, so duplicates are fine. A cleared
 * browser comes back as a stranger — signing in is what makes a roll follow the person.
 */
export async function getGuestContext(code: string): Promise<GuestContext | null> {
  const roll = await getRollByJoinCode(code);
  if (!roll) return null;

  let guest: GuestRow | null = null;

  const claims = await readGuestClaims(roll.code);
  if (claims && claims.eventId === roll.id) {
    const found = await prisma.guest.findUnique({
      where: { id: claims.guestId },
      select: guestFields,
    });
    if (found && found.rollId === roll.id) guest = found;
  }

  if (!guest) {
    const user = await getCurrentUser();
    if (user) {
      guest = await prisma.guest.findFirst({
        where: { rollId: roll.id, userId: user.id },
        select: guestFields,
      });

      // A host of a roll created before hosts were enrolled at creation, enrolled now.
      if (!guest && user.id === roll.hostId) {
        guest = await prisma.guest.upsert({
          where: { rollId_userId: { rollId: roll.id, userId: user.id } },
          create: { rollId: roll.id, name: user.name, userId: user.id },
          update: {},
          select: guestFields,
        });
      }
    }
  }

  if (!guest) return null;

  // Pending uploads count too, or holding the shutter down would mint unlimited upload URLs.
  const shotsUsed = await prisma.photo.count({ where: { guestId: guest.id } });

  return {
    roll,
    guest,
    phase: rollPhase(roll),
    open: isOpen(roll),
    capturing: isCapturing(roll),
    acceptsUploads: acceptsUploads(roll),
    shotsUsed,
    // Film drawn from the pool is theirs to spend; film given away is not.
    shotsLeft: Math.max(0, roll.photosPerGuest + guest.fromPool - shotsUsed),
  };
}
