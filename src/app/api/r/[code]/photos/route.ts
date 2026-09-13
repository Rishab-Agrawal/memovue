import { nanoid } from "nanoid";
import { after } from "next/server";

import { getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { limited } from "@/lib/ratelimit";
import { visiblePhotoWhere } from "@/lib/roll-access";
import { photoKey, presignUpload, publicUrl } from "@/lib/storage";
import { notify } from "@/lib/telegram";
import { photoInitSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Reserves one of the guest's shots and hands back presigned URLs so the browser can PUT the
 * bytes straight to R2. The PENDING row is what stops a guest issuing more URLs than shots.
 */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const context = await getGuestContext(code);
  if (!context) return Response.json({ error: "not_joined" }, { status: 401 });

  // `acceptsUploads`, not `capturing`: queued photos drain after the close. See `roll-access.ts`.
  if (!context.acceptsUploads) {
    return Response.json({ error: "not_shooting" }, { status: 403 });
  }
  if (context.shotsLeft <= 0) {
    return Response.json({ error: "no_shots_left" }, { status: 409 });
  }

  // Keyed on the guest alone: an IP would reset the budget on every network change.
  const over = limited(`reserve:${context.guest.id}`, 40, 60);
  if (over) return over;

  const body = await request.json().catch(() => null);
  const parsed = photoInitSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  const photoId = nanoid();
  // The capability. Never derived from anything the client knows.
  const secret = nanoid();
  const fullKey = photoKey(context.roll.id, photoId, secret, "full");
  const previewKey = photoKey(context.roll.id, photoId, secret, "preview");

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

  // The roll's first frame starts the pool's clock (see `refillsLeft`). Conditional, so only one phone wins.
  if (!context.roll.firstShotAt) {
    const { count } = await prisma.roll.updateMany({
      where: { id: context.roll.id, firstShotAt: null },
      data: { firstShotAt: new Date() },
    });
    if (count) {
      after(() => notify("signals", `First shot — “${context.roll.name}” · ${context.roll.host.name}`));
    }
  }

  const [fullUrl, previewUrl] = await Promise.all([
    presignUpload(fullKey, "image/jpeg", parsed.data.fullBytes),
    presignUpload(previewKey, "image/jpeg", parsed.data.previewBytes),
  ]);

  return Response.json({
    photoId,
    fullUrl,
    previewUrl,
    shotsLeft: context.shotsLeft - 1,
  });
}

/**
 * The photo grid, in pages of 48.
 *
 * Sealed, it returns blur placeholders only. Open, each item also carries its preview and full
 * URLs — this is the only place the seal guards them, since the keys are unguessable and no
 * other route hands them out.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const context = await getGuestContext(code);
  if (!context) return Response.json({ error: "not_joined" }, { status: 401 });

  // Higher than the feed's, because scrolling a large album pages in bursts.
  const over = limited(`grid:${context.guest.id}`, 120, 60);
  if (over) return over;

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const guestId = url.searchParams.get("guestId");
  const take = 48;

  /*
    Ownership applies sealed as well as open, so the wall a guest watches fill is exactly the
    album they get at the reveal. `?guestId=` can narrow the list to one photographer but
    never widen it past `visiblePhotoWhere`.
  */
  const where = {
    ...visiblePhotoWhere(context.roll, { kind: "guest", guestId: context.guest.id }),
    ...(context.open && guestId && context.roll.everyoneCanSee ? { guestId } : {}),
  };

  const photos = await prisma.photo.findMany({
    where,
    orderBy: [{ takenAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      blurData: true,
      previewKey: true,
      fullKey: true,
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
      fullUrl: publicUrl(photo.fullKey),
    };
  });

  return Response.json({
    items,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
