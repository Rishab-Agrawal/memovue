import { nanoid } from "nanoid";

import { getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { visiblePhotoWhere } from "@/lib/roll-access";
import { photoKey, presignUpload, publicUrl } from "@/lib/storage";
import { photoInitSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Reserves one of the guest's shots and hands back presigned URLs so the browser can PUT
 * the image bytes straight to R2. The row is created PENDING up front — that reservation
 * is what stops a guest from issuing more upload URLs than they have shots.
 */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const context = await getGuestContext(code);
  if (!context) return Response.json({ error: "not_joined" }, { status: 401 });

  /*
    `acceptsUploads`, not `capturing`.

    A reservation is made when the bytes reach us, which is not when the shutter fired — the
    queue holds photographs in IndexedDB until the phone has signal. Gating this on `capturing`
    refused every photo taken in the last minutes of an event and drained after it closed, and
    because that refusal is permanent the client then deleted the only copy. The shutter is
    still closed on time; the camera is what enforces that.
  */
  if (!context.acceptsUploads) {
    return Response.json({ error: "not_shooting" }, { status: 403 });
  }
  if (context.shotsLeft <= 0) {
    return Response.json({ error: "no_shots_left" }, { status: 409 });
  }

  const limit = rateLimit(`photo:${context.guest.id}:${clientIp(request)}`, 40, 60);
  if (!limit.ok) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = photoInitSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  const photoId = nanoid();
  const fullKey = photoKey(context.roll.id, photoId, "full");
  const previewKey = photoKey(context.roll.id, photoId, "preview");

  await prisma.photo.create({
    data: {
      id: photoId,
      rollId: context.roll.id,
      guestId: context.guest.id,
      fullKey,
      previewKey,
      blurData: "",
      width: 0,
      height: 0,
      bytes: 0,
      status: "PENDING",
    },
  });

  const [fullUrl, previewUrl] = await Promise.all([
    presignUpload(fullKey, "image/jpeg"),
    presignUpload(previewKey, "image/jpeg"),
  ]);

  return Response.json({
    photoId,
    fullUrl,
    previewUrl,
    shotsLeft: context.shotsLeft - 1,
  });
}

/**
 * The photo grid, in pages of 48. Both phases of a roll come through here.
 *
 * **Sealed**, this returns blur placeholders and nothing else: no preview URL, no name, no
 * timestamp. Every guest sees every frame's placeholder, attributed to nobody but themselves
 * — the same thing the sealed feed used to serve, minus the part that resolves to bytes.
 * **Open**, `visiblePhotoWhere` decides whose frames this guest gets, and each item carries a
 * signed URL for the 1080px preview.
 *
 * The seal is one branch, checked once, here. It is worth saying plainly why the sealed
 * branch is safe to serve at all: `previewUrl` is the only field that leads to image data,
 * and it is not constructed on that path. `/photos/[id]/full` re-checks `canViewPhoto`
 * independently, so a guessed id gets a 403 rather than a photograph.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const context = await getGuestContext(code);
  if (!context) return Response.json({ error: "not_joined" }, { status: 401 });

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const guestId = url.searchParams.get("guestId");
  const take = 48;

  /*
    The ownership filter comes from `visiblePhotoWhere`, not from this route.

    A guest may narrow the list to one photographer with `?guestId=`, but they cannot widen
    it: the base clause already restricts them to their own frames when visibility is off,
    and spreading the query param afterwards can only ever intersect with that.

    Sealed, ownership does not apply — nothing is legible, so there is nothing to filter.
  */
  const where = context.open
    ? {
        ...visiblePhotoWhere(context.roll, { kind: "guest", guestId: context.guest.id }),
        ...(guestId && context.roll.everyoneCanSee ? { guestId } : {}),
      }
    : { rollId: context.roll.id, status: "READY" as const };

  const photos = await prisma.photo.findMany({
    where,
    orderBy: [{ takenAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      blurData: true,
      previewKey: true,
      width: true,
      height: true,
      takenAt: true,
      guest: { select: { id: true, name: true } },
    },
  });

  const hasMore = photos.length > take;
  const page = hasMore ? photos.slice(0, take) : photos;

  const items = page.map((photo) => {
    const mine = photo.guest.id === context.guest.id;

    if (!context.open) {
      return { id: photo.id, blurData: photo.blurData, mine, by: mine ? "You" : null };
    }

    return {
      id: photo.id,
      blurData: photo.blurData,
      mine,
      by: mine ? "You" : photo.guest.name,
      width: photo.width,
      height: photo.height,
      takenAt: photo.takenAt.toISOString(),
      guestId: photo.guest.id,
      guestName: photo.guest.name,
      previewUrl: publicUrl(photo.previewKey),
    };
  });

  return Response.json({
    items,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
