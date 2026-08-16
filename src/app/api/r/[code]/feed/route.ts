import { getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { visiblePhotoWhere } from "@/lib/roll-access";

export const dynamic = "force-dynamic";

/**
 * What a guest is allowed to see of a roll, right now.
 *
 * Two gates, in this order. **Sealed** returns blur placeholders and counts and nothing
 * else — no photo ids that resolve to bytes, for anybody, including the person who took
 * them. **Open** then filters by ownership: `visiblePhotoWhere` decides whether this guest
 * gets the whole roll or only their own frames, and it is the same function the single-photo
 * route consults, so the grid and the image endpoint cannot disagree.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const context = await getGuestContext(code);
  if (!context) return Response.json({ error: "not_joined" }, { status: 401 });

  const { roll, guest, phase, open, capturing, shotsLeft, shotsUsed } = context;

  const totalPhotos = await prisma.photo.count({
    where: { rollId: roll.id, status: "READY" },
  });

  const shared = {
    phase,
    open,
    capturing,
    rollName: roll.name,
    hostName: roll.host.name,
    coverPreset: roll.coverPreset,
    everyoneCanSee: roll.everyoneCanSee,
    revealAt: roll.revealAt.toISOString(),
    finishesAt: roll.finishesAt.toISOString(),
    keptUntil: roll.keptUntil.toISOString(),
    totalPhotos,
    guestCount: await prisma.guest.count({ where: { rollId: roll.id } }),
    me: {
      id: guest.id,
      name: guest.name,
      shotsLeft,
      shotsUsed,
      photosPerGuest: roll.photosPerGuest,
    },
  };

  if (!open) {
    // Sealed. Every frame is accounted for, none is legible.
    const sealed = await prisma.photo.findMany({
      where: { rollId: roll.id, status: "READY" },
      orderBy: { takenAt: "desc" },
      select: { id: true, blurData: true, guestId: true },
    });

    return Response.json({
      ...shared,
      photos: sealed.map((photo) => ({
        id: photo.id,
        blurData: photo.blurData,
        by: photo.guestId === guest.id ? "You" : null,
        mine: photo.guestId === guest.id,
      })),
    });
  }

  const photos = await prisma.photo.findMany({
    where: visiblePhotoWhere(roll, { kind: "guest", guestId: guest.id }),
    orderBy: { takenAt: "desc" },
    select: {
      id: true,
      blurData: true,
      takenAt: true,
      guestId: true,
      guest: { select: { name: true } },
    },
  });

  return Response.json({
    ...shared,
    photos: photos.map((photo) => ({
      id: photo.id,
      blurData: photo.blurData,
      by: photo.guestId === guest.id ? "You" : photo.guest.name,
      mine: photo.guestId === guest.id,
      takenAt: photo.takenAt.toISOString(),
    })),
  });
}
