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

/** Enough of a roll to work out where its screens are. */
type Located = { id: string; code: string; hostId: string };

/**
 * The roll's own screen, for whoever is holding its camera.
 *
 * The host has `/rolls/[id]`, with its settings and its invite QR. Everybody else has the
 * guest album, and that includes guests who never made an account — the reason this returns a
 * string rather than a nullable one. It used to be null for them, so the camera's back arrow
 * simply wasn't drawn and the roll had no screen they could reach.
 */
export async function rollHome(roll: Located): Promise<string> {
  const user = await getCurrentUser();
  return user?.id === roll.hostId ? `/rolls/${roll.id}` : `/e/${roll.code}/album`;
}

/** Out of the roll altogether: your own list if you have one, the way you came in if not. */
export async function guestHome(roll: Located): Promise<string> {
  const user = await getCurrentUser();
  if (!user) return "/";
  return user.id === roll.hostId ? `/rolls/${roll.id}` : "/rolls";
}

const guestFields = { id: true, name: true, rollId: true, userId: true } as const;

/**
 * Resolves whoever is holding this roll's camera, by cookie or by account.
 *
 * The cookie is the credential, and for almost everybody it is the only one: a guest is a
 * browser that joined, and the name they typed is a caption on their photographs rather than
 * anything this looks up. Nothing here asks whether that name is taken, because two people
 * at the same wedding are routinely called the same thing.
 *
 * What that costs is a browser cleared mid-event: those photographs stay in the album under
 * the name that took them, but the phone comes back as a stranger and joins again. The fix
 * for anyone who cares is the account below — sign in on the first device, sign in on the
 * second, and the roll follows the person rather than the browser.
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
    if (found && found.rollId === roll.id) guest = found;
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
