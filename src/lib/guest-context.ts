import { readGuestClaims } from "./auth";
import { normalizeCode } from "./codes";
import { prisma } from "./prisma";
import { type EventPhase, eventPhase } from "./reveal";

export interface GuestContext {
  event: NonNullable<Awaited<ReturnType<typeof findEvent>>>;
  guest: { id: string; name: string; relation: string | null; relationSide: string | null };
  phase: EventPhase;
  shotsUsed: number;
  shotsLeft: number;
}

function findEvent(code: string) {
  return prisma.event.findUnique({ where: { code: normalizeCode(code) } });
}

export async function getEventByCode(code: string) {
  return findEvent(code);
}

/**
 * Resolves the signed guest cookie into a live guest, or null.
 *
 * `tokenVersion` is checked so reclaiming a name on a new device silently signs the old
 * device out — one active session per guest, which makes a hijack immediately obvious to
 * whoever actually owns the name.
 */
export async function getGuestContext(code: string): Promise<GuestContext | null> {
  const event = await findEvent(code);
  if (!event) return null;

  const claims = await readGuestClaims(event.code);
  if (!claims || claims.eventId !== event.id) return null;

  const guest = await prisma.guest.findUnique({
    where: { id: claims.guestId },
    select: {
      id: true,
      name: true,
      relation: true,
      relationSide: true,
      eventId: true,
      tokenVersion: true,
    },
  });
  if (!guest || guest.eventId !== event.id || guest.tokenVersion !== claims.tokenVersion) {
    return null;
  }

  // In-flight uploads count against the quota too, otherwise a guest could hold the
  // shutter down and issue far more upload URLs than they're entitled to.
  const shotsUsed = await prisma.photo.count({ where: { guestId: guest.id } });

  return {
    event,
    guest: {
      id: guest.id,
      name: guest.name,
      relation: guest.relation,
      relationSide: guest.relationSide,
    },
    phase: eventPhase(event),
    shotsUsed,
    shotsLeft: Math.max(0, event.photosPerGuest - shotsUsed),
  };
}
