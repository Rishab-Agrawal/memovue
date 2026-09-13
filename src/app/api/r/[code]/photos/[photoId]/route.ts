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

/** One budget across all three verbs, set above the reserve route's so a full queue never trips it. */
function overBudget(guestId: string): Response | null {
  return limited(`photo:${guestId}`, 90, 60);
}

/**
 * Re-signs upload URLs for a shot that is already reserved. URLs expire in ten minutes, and a
 * phone can be offline longer; this reuses the reservation instead of spending a second shot.
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
    A backstop: the signed URL already pins the exact length. This notices if signing ever
    stopped doing so, and deletes oversized objects rather than paying to store them.
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
      ...(parsed.data.takenAt
        ? { takenAt: takenAtWithin(new Date(parsed.data.takenAt), context.roll) }
        : {}),
    },
  });

  /*
    A confirm after the upload window closes invalidates the cached ZIP, which was built on the
    premise that a settled roll cannot change. Swallowed: refusing the confirm would lose the photo.
  */
  if (!context.acceptsUploads && storageConfigured) {
    await deleteObjects([zipKey(context.roll.id)]).catch((error) => {
      console.error("Could not invalidate cached ZIP", error);
    });
  }

  return Response.json({ ok: true });
}

/**
 * Releases a reserved shot, when a guest rejects a frame or the queue gives up on one.
 * Only the second is counted: it is the one failure that destroys something a person meant to keep.
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
