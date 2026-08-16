import { getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { canViewPhoto } from "@/lib/roll-access";
import { presignDownload } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * The only route that hands over full-resolution bytes, so it is the one a leak would come
 * through.
 *
 * It asks `canViewPhoto` rather than re-deriving anything. Two checks, in order: the roll
 * has to be open at all, and then the photo has to be one this guest is allowed to see —
 * their own, or anyone's if the host turned visibility on. The URL is signed for an hour so
 * a copied link stops working rather than exposing the album indefinitely.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string; photoId: string }> },
) {
  const { code, photoId } = await params;

  const context = await getGuestContext(code);
  if (!context) return Response.json({ error: "not_joined" }, { status: 401 });

  const photo = await prisma.photo.findFirst({
    where: { id: photoId, rollId: context.roll.id, status: "READY" },
    select: { fullKey: true, guestId: true },
  });
  if (!photo) return Response.json({ error: "not_found" }, { status: 404 });

  if (!canViewPhoto(context.roll, photo, { kind: "guest", guestId: context.guest.id })) {
    // Deliberately not 404: the photo exists and the guest knows it does — the grid showed
    // them a blurred placeholder. Pretending otherwise would be confusing, not safer.
    return Response.json({ error: "not_visible" }, { status: 403 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";

  const url = await presignDownload(photo.fullKey, {
    expiresIn: 3600,
    filename: download ? `memovue-${photoId}.jpg` : undefined,
  });

  return Response.redirect(url, 307);
}
