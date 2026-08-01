import { getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** How many blurred teasers we show per person before the reveal. */
const TEASER_LIMIT = 8;

/**
 * The social wall: who's shooting, and how much.
 *
 * Before the reveal this returns only the inline blur placeholders — there is deliberately
 * no path to a legible image, for anyone, including the photographer. People with zero
 * photos are left out entirely so nobody gets publicly counted as the one not joining in.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const context = await getGuestContext(code);
  if (!context) return Response.json({ error: "not_joined" }, { status: 401 });

  const { event, guest, phase, shotsLeft, shotsUsed } = context;

  const guests = await prisma.guest.findMany({
    where: { eventId: event.id, photos: { some: { status: "READY" } } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      _count: { select: { photos: { where: { status: "READY" } } } },
      photos: {
        where: { status: "READY" },
        orderBy: { takenAt: "desc" },
        take: TEASER_LIMIT,
        select: { id: true, blurData: true },
      },
    },
  });

  const totalPhotos = await prisma.photo.count({
    where: { eventId: event.id, status: "READY" },
  });

  return Response.json({
    phase,
    revealAt: event.revealAt.toISOString(),
    revealedEarly: event.revealedEarly,
    eventName: event.name,
    totalPhotos,
    me: {
      id: guest.id,
      name: guest.name,
      shotsLeft,
      shotsUsed,
      photosPerGuest: event.photosPerGuest,
    },
    people: guests.map((g) => ({
      id: g.id,
      name: g.name,
      count: g._count.photos,
      isMe: g.id === guest.id,
      teasers: g.photos.map((p) => ({ id: p.id, blurData: p.blurData })),
    })),
  });
}
