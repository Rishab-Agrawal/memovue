import { after } from "next/server";

import { UPLOAD_LIMITS } from "@/lib/constants";
import { getGuestContext } from "@/lib/guest-context";
import { record } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { limited } from "@/lib/ratelimit";
import { takenAtWithin } from "@/lib/roll-access";
import { deleteObjects, headObject, presignUpload, storageConfigured, zipKey } from "@/lib/storage";
import { photoConfirmSchema, photoResignSchema } from "@/lib/validation";

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
  request: Request,
  { params }: { params: Promise<{ code: string; photoId: string }> },
) {
  const { code, photoId } = await params;

  const context = await getGuestContext(code);
  if (!context) return Response.json({ error: "not_joined" }, { status: 401 });

  const over = overBudget(context.guest.id);
  if (over) return over;

  // The lengths again, because a presigned PUT pins one exact size and the retry is for the
  // same two blobs. The queue still holds them, so it can say.
  const body = await request.json().catch(() => null);
  const parsed = photoResignSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { guestId: true, status: true, fullKey: true, previewKey: true },
  });
  if (!photo || photo.guestId !== context.guest.id) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (photo.status === "READY") return Response.json({ alreadyConfirmed: true });

  const [fullUrl, previewUrl] = await Promise.all([
    presignUpload(photo.fullKey, "image/jpeg", parsed.data.fullBytes),
    presignUpload(photo.previewKey, "image/jpeg", parsed.data.previewBytes),
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
    The ceiling, measured after the fact — a backstop now rather than the rule.

    The rule moved to where the bytes arrive: the upload URL is signed for one exact length,
    so R2 refuses a body of any other size and there is nothing left for this to catch. It
    stays because it is two HEADs against a bucket, it is the only thing that would notice if
    the signing ever quietly stopped pinning the length, and this is a path that costs money
    when it is wrong. `bytes` in the request body is still only a claim, which is why R2's
    number is preferred below.

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
 *
 * The second case is counted and the first is not. A guest deciding against a photograph is
 * the product working; the queue giving up on one is the product's most fragile path failing,
 * and it is the only failure in the app that destroys something a person meant to keep. The
 * row is gone by the end of this handler, so if it is not counted here it is not knowable at
 * all — which is exactly the test for whether something belongs in `Metric`.
 */
export async function DELETE(
  request: Request,
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

  if (new URL(request.url).searchParams.get("reason") === "dropped") {
    after(() => record("upload_dropped"));
  }

  return Response.json({ ok: true });
}
