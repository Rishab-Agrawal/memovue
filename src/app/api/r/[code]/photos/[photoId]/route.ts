import { UPLOAD_LIMITS } from "@/lib/constants";
import { getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { limited } from "@/lib/ratelimit";
import { takenAtWithin } from "@/lib/roll-access";
import { deleteObjects, headObject, presignUpload, storageConfigured, zipKey } from "@/lib/storage";
import { photoConfirmSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * One budget across all three verbs, because they are one piece of work.
 *
 * The queue drains a photograph at a time — re-sign, upload, confirm — so what this bounds is
 * how fast a guest can march through their reservations, not how many times they may use one
 * particular method. That matters most for the confirm, which is the only route in the app
 * that asks R2 about an object, twice, on somebody else's schedule.
 *
 * Ninety a minute sits comfortably above the forty reservations a minute the route next door
 * allows, so a queue running flat out is never refused by this.
 */
function overBudget(guestId: string): Response | null {
  return limited(`photo:${guestId}`, 90, 60);
}

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

  const over = overBudget(context.guest.id);
  if (over) return over;

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

  const over = overBudget(context.guest.id);
  if (over) return over;

  const body = await request.json().catch(() => null);
  const parsed = photoConfirmSchema.safeParse({ ...body, photoId });
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { id: true, guestId: true, status: true, fullKey: true, previewKey: true },
  });
  if (!photo || photo.guestId !== context.guest.id) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (photo.status === "READY") return Response.json({ ok: true });

  /*
    The ceiling, measured rather than declared.

    The client encodes every capture down to `fullMaxEdge` at `fullQuality` before it uploads,
    so a real photograph lands around a megabyte however good the phone's camera is — the cap
    is not for them. It is for the fact that a presigned PUT pins the content type and cannot
    pin the body length, so the only trustworthy size is the one R2 reports. `bytes` in the
    request body is a claim by the same caller that chose what to send.

    Over the cap, the objects go back out: leaving them would bill us for storage on a
    photograph the album will never show. This is also the reason there is no re-encode step
    on the server — the resize already happened on the device that took the shot, which is
    both cheaper and the only place the full-resolution frame ever exists.
  */
  const measured = storageConfigured
    ? await Promise.all([headObject(photo.fullKey), headObject(photo.previewKey)])
    : [];

  if (measured.some((object) => object && object.bytes > UPLOAD_LIMITS.maxBytes)) {
    await deleteObjects([photo.fullKey, photo.previewKey]).catch(() => {});
    await prisma.photo.delete({ where: { id: photoId } });
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  await prisma.photo.update({
    where: { id: photoId },
    data: {
      status: "READY",
      width: parsed.data.width,
      height: parsed.data.height,
      // R2's number when we have it, the claim only as a fallback.
      bytes: measured[0]?.bytes ?? parsed.data.bytes,
      blurData: parsed.data.blurData,
      // Left alone when the client did not send one: the row's reservation-time default is
      // the older, worse answer, but it is still an answer.
      ...(parsed.data.takenAt
        ? { takenAt: takenAtWithin(new Date(parsed.data.takenAt), context.roll) }
        : {}),
    },
  });

  /*
    A late arrival invalidates the host's cached archive.

    The ZIP is built once, after the upload window closes, on the premise that a settled roll
    cannot change. This route is the one thing that can still change it: a shot reserved before
    that deadline may be confirmed at any time afterwards — by a phone that was off for a week
    and has only now drained its queue — and nothing else re-examines the archive. Without
    this, the download would be missing exactly the photograph that had the hardest journey,
    silently and for good.

    Only past the window, so the common case costs nothing: before it, there is no archive to
    invalidate. Swallowed rather than fatal, because refusing the confirm would put us back to
    losing the photograph outright, which is the worse of the two failures.
  */
  if (!context.acceptsUploads && storageConfigured) {
    await deleteObjects([zipKey(context.roll.id)]).catch((error) => {
      console.error("Could not invalidate cached ZIP", error);
    });
  }

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

  const over = overBudget(context.guest.id);
  if (over) return over;

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
