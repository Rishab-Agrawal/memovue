import { nanoid } from "nanoid";
import { after } from "next/server";

import { getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { limited } from "@/lib/ratelimit";
import { shotsLeftFor } from "@/lib/roll-config";
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

  // Keyed on the guest alone: an IP would reset the budget on every network change.
  const over = limited(`reserve:${context.guest.id}`, 40, 60);
  if (over) return over;

  const body = await request.json().catch(() => null);
  const parsed = photoInitSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  const { roll, guest } = context;
  const { clientId } = parsed.data;

  /*
    One step per guest: their row stays locked from the count to the insert, so requests sent
    together cannot all spend the same film. A frame asked for again gets its first reservation.
  */
  const reserved = await prisma.$transaction(async (tx) => {
    const [mine] = await tx.$queryRaw<{ fromPool: number }[]>`
      SELECT "fromPool" FROM "Guest" WHERE id = ${guest.id} FOR UPDATE`;
    if (!mine) return null;

    const used = await tx.photo.count({ where: { guestId: guest.id } });
    const left = shotsLeftFor(roll, mine.fromPool, used);
    const select = { id: true, fullKey: true, previewKey: true } as const;
    const asked = await tx.photo.findUnique({
      where: { guestId_clientId: { guestId: guest.id, clientId } },
      select,
    });
    if (asked) return { ...asked, left };
    if (left <= 0) return null;

    const id = nanoid();
    // The capability. Never derived from anything the client knows.
    const secret = nanoid();
    const photo = await tx.photo.create({
      data: {
        id,
        rollId: roll.id,
        guestId: guest.id,
        clientId,
        fullKey: photoKey(roll.id, id, secret, "full"),
        previewKey: photoKey(roll.id, id, secret, "preview"),
        blurData: "",
        width: 0,
        height: 0,
        bytes: 0,
        status: "PENDING",
      },
      select,
    });
    return { ...photo, left: left - 1 };
  });
  if (!reserved) return Response.json({ error: "no_shots_left" }, { status: 409 });

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
    presignUpload(reserved.fullKey, "image/jpeg", parsed.data.fullBytes),
    presignUpload(reserved.previewKey, "image/jpeg", parsed.data.previewBytes),
  ]);

  return Response.json({
    photoId: reserved.id,
    fullUrl,
    previewUrl,
    shotsLeft: reserved.left,
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
