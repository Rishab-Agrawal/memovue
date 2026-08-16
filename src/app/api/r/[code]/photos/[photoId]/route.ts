import { getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { deleteObjects, presignUpload } from "@/lib/storage";
import { photoConfirmSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Re-signs upload URLs for a shot that's already reserved.
 *
 * Upload URLs expire in ten minutes, and a phone that loses signal at a wedding can
 * easily be offline longer than that. Retrying through here reuses the existing
 * reservation instead of burning a second shot on the same photo.
 */
export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ code: string; photoId: string }> },
) {
  const { code, photoId } = await params;

  const context = await getGuestContext(code);
  if (!context) return Response.json({ error: "not_joined" }, { status: 401 });

  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { guestId: true, status: true, fullKey: true, previewKey: true },
  });
  if (!photo || photo.guestId !== context.guest.id) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (photo.status === "READY") return Response.json({ alreadyConfirmed: true });

  const [fullUrl, previewUrl] = await Promise.all([
    presignUpload(photo.fullKey, "image/jpeg"),
    presignUpload(photo.previewKey, "image/jpeg"),
  ]);

  return Response.json({ photoId, fullUrl, previewUrl });
}

/** Marks an upload complete. Until this lands the photo stays PENDING and shows nowhere. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string; photoId: string }> },
) {
  const { code, photoId } = await params;

  const context = await getGuestContext(code);
  if (!context) return Response.json({ error: "not_joined" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = photoConfirmSchema.safeParse({ ...body, photoId });
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { id: true, guestId: true, status: true },
  });
  if (!photo || photo.guestId !== context.guest.id) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (photo.status === "READY") return Response.json({ ok: true });

  await prisma.photo.update({
    where: { id: photoId },
    data: {
      status: "READY",
      width: parsed.data.width,
      height: parsed.data.height,
      bytes: parsed.data.bytes,
      blurData: parsed.data.blurData,
    },
  });

  return Response.json({ ok: true });
}

/**
 * Releases a reserved shot. Called when a guest rejects a frame they'd already started
 * uploading, or when the client gives up on a failed upload — without this the shot would
 * stay spent on a photo that never existed.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ code: string; photoId: string }> },
) {
  const { code, photoId } = await params;

  const context = await getGuestContext(code);
  if (!context) return Response.json({ error: "not_joined" }, { status: 401 });

  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { id: true, guestId: true, status: true, fullKey: true, previewKey: true },
  });
  if (!photo || photo.guestId !== context.guest.id) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  // A confirmed photo belongs to the album now — guests don't get to un-take a shot.
  if (photo.status === "READY") {
    return Response.json({ error: "already_submitted" }, { status: 409 });
  }

  await deleteObjects([photo.fullKey, photo.previewKey]);
  await prisma.photo.delete({ where: { id: photoId } });

  return Response.json({ ok: true });
}
