import { nanoid } from "nanoid";

import { getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { limited } from "@/lib/ratelimit";
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

  /*
    The address used to be part of this key. It only ever weakened it: a guest is identified
    by a signed cookie, so folding in an IP handed the same guest a fresh budget every time
    their phone changed network, and gave a whole venue's worth of honest guests nothing.
  */
  const over = limited(`reserve:${context.guest.id}`, 40, 60);
  if (over) return over;

  const body = await request.json().catch(() => null);
  const parsed = photoInitSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  const photoId = nanoid();
  // The capability. Never derived from anything the client knows, and never sent to anyone
  // the photograph is not already being shown to.
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
 * timestamp. **Open**, each item additionally carries a URL for the 1080px preview and the
 * original. `visiblePhotoWhere` decides which frames exist in both cases, so the wall a guest
 * watches fill up is exactly the album they end up with.
 *
 * The seal is one branch, checked once, here — and since the full-resolution URL travels in
 * this payload, this is now the only place it is checked at all. That is worth saying plainly.
 * A photo id is not a capability: `previewUrl` and `fullUrl` are the only fields that lead to
 * image data, neither is constructed on the sealed path, and the keys they carry each hold a
 * random segment. So an id guessed off the sealed grid has nothing to be exchanged for —
 * there is no route left to present it to, and the address cannot be derived from it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const context = await getGuestContext(code);
  if (!context) return Response.json({ error: "not_joined" }, { status: 401 });

  // Higher than the feed's, because the grid pages: opening a five-hundred-photo album and
  // scrolling to the bottom is eleven of these in a burst, and doing that twice is normal.
  const over = limited(`grid:${context.guest.id}`, 120, 60);
  if (over) return over;

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const guestId = url.searchParams.get("guestId");
  const take = 48;

  /*
    The ownership filter comes from `visiblePhotoWhere`, not from this route, and it applies
    sealed as well as open.

    Sealed used to mean "every frame in the roll", on the reasoning that a placeholder is not
    a photograph. It is not, but it is a promise: on a roll where only the host sees
    everything, a guest watched three hundred tiles fill up all evening and then, at the one
    moment the whole product exists for, was left with the twelve that were theirs. The wall
    shrinking at the reveal reads as loss, and the seal lifting is the worst possible time to
    look like we have lost something.

    A guest may still narrow the list to one photographer with `?guestId=`, but they cannot
    widen it: the base clause already restricts them to their own frames when visibility is
    off, and spreading the query param afterwards can only ever intersect with that.
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
      /*
        The full-resolution capability, handed over in the same breath as the preview.

        The viewer used to reach a route of its own for this, which re-derived the guest
        session and re-checked the seal — four Postgres queries and a dynamic render for
        every frame swiped past, on the screen people spend the whole evening in. The
        authorisation has already happened, once, in the query above: `visiblePhotoWhere`
        decides which rows exist here at all, and the sealed branch returns before this line.
        Asking the same question a second time cost far more than it was worth.
      */
      fullUrl: publicUrl(photo.fullKey),
    };
  });

  return Response.json({
    items,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
