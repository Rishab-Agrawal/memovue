import { nanoid } from "nanoid";

import { getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { visiblePhotoWhere } from "@/lib/roll-access";
import { photoKey, presignDownload, presignUpload } from "@/lib/storage";
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

/** Post-reveal photo grid, paginated so a 12,000-photo wedding doesn't arrive in one response. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const context = await getGuestContext(code);
  if (!context) return Response.json({ error: "not_joined" }, { status: 401 });
  if (!context.open) {
    return Response.json({ error: "not_revealed" }, { status: 403 });
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const guestId = url.searchParams.get("guestId");
  const take = 48;

  /*
    The ownership filter comes from `visiblePhotoWhere`, not from this route.

    A guest may narrow the list to one photographer with `?guestId=`, but they cannot widen
    it: the base clause already restricts them to their own frames when visibility is off,
    and spreading the query param afterwards can only ever intersect with that.
  */
  const photos = await prisma.photo.findMany({
    where: {
      ...visiblePhotoWhere(context.roll, { kind: "guest", guestId: context.guest.id }),
      ...(guestId && context.roll.everyoneCanSee ? { guestId } : {}),
    },
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

  const items = await Promise.all(
    page.map(async (photo) => ({
      id: photo.id,
      blurData: photo.blurData,
      width: photo.width,
      height: photo.height,
      takenAt: photo.takenAt.toISOString(),
      guestId: photo.guest.id,
      guestName: photo.guest.name,
      previewUrl: await presignDownload(photo.previewKey, { expiresIn: 3600 }),
    })),
  );

  return Response.json({
    items,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
