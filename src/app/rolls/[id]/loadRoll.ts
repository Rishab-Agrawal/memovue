import "server-only";

import { notFound } from "next/navigation";

import { ZIP_DOWNLOAD_LIMIT } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { isOpen } from "@/lib/roll-access";
import { coverUrlFor, getRollForHost, poolLeft } from "@/lib/rolls";
import { publicUrl } from "@/lib/storage";
import { requireHost } from "@/lib/session";

import type { BackdropPhoto, BackdropRoll } from "./RollBackdrop";

/**
 * How much of the wall one screenful of scrolling is worth.
 *
 * There was no number here at all: every READY photograph in the roll was loaded, serialised
 * into the page and drawn as a tile — on four routes, since the three sheets render this
 * screen behind them. A five-hundred-guest roll is eighteen thousand frames, each carrying its
 * own inlined placeholder, so the host screen was a twenty-megabyte payload and eighteen
 * thousand DOM nodes on whatever phone the host happened to be holding. The guest album was
 * given paging for exactly this reason; this screen never got it.
 *
 * A hundred and twenty is sixty rows of two: more than anyone scrolls through in one go, and
 * few enough to draw. The rest is a link away rather than gone — silently capping a host's own
 * album at a number would be a worse bug than the one it fixed.
 */
export const WALL_PAGE = 120;

/**
 * What a sheet needs behind it.
 *
 * The sheet routes render this screen as a backdrop under a dimmed, blurred overlay that also
 * locks scrolling, so nothing past the first viewport is ever seen there however large the
 * roll is. Two of them draw no backdrop at all and ask for none.
 */
export const BACKDROP_PHOTOS = 8;

/**
 * Everything the roll screen and its three sheets need, in one place so they cannot drift.
 *
 * The photo list is loaded through the same seal the guest routes use: a closed roll returns
 * credits and placeholders but no image keys at all. Fetching the images and hiding them in
 * CSS would put them in the page source, which is not hiding them.
 */
export async function loadRoll(
  id: string,
  take: number = WALL_PAGE,
): Promise<{
  roll: BackdropRoll;
  photos: BackdropPhoto[];
  /** Whether the roll holds frames this page did not ask for. */
  more: boolean;
}> {
  const user = await requireHost();
  const found = await getRollForHost(id, user.id);
  if (!found) notFound();

  const open = isOpen(found);
  const coverUrl = coverUrlFor(found);

  /*
    The host's own film, if they have joined their own roll to shoot it.

    They hold a Guest row like anybody else, so their quota is counted the same way. A host
    who never joined has spent nothing and gets the full allowance — which is right: the
    camera button is what takes them into the join flow.
  */
  const [mine, pool] = await Promise.all([
    prisma.guest.findFirst({
      where: { rollId: found.id, userId: user.id },
      select: { fromPool: true, _count: { select: { photos: true } } },
    }),
    poolLeft(found),
  ]);
  const shotsLeft = Math.max(
    0,
    found.photosPerGuest + (mine?.fromPool ?? 0) - (mine?._count.photos ?? 0),
  );

  /*
    One past the page, so "is there more" comes out of the same read rather than a second
    count.

    `blurData` only while the roll is sealed. It is the tile then — a ~32px JPEG inlined as a
    data URL — and it is the largest field on the row by an order of magnitude. Once the roll
    is open every tile draws from `previewKey` instead and the placeholder is never read, so
    sending it was most of the payload spent on nothing.
  */
  const page =
    take > 0
      ? await prisma.photo.findMany({
          where: { rollId: found.id, status: "READY" },
          orderBy: [{ takenAt: "desc" }, { id: "desc" }],
          take: take + 1,
          select: {
            id: true,
            previewKey: true,
            fullKey: true,
            blurData: !open,
            guest: { select: { name: true } },
          },
        })
      : [];

  const more = page.length > take;
  const photos = more ? page.slice(0, take) : page;

  /*
    The host's own grid showed gradient stand-ins and nothing else — before the reveal, which
    is right, and after it, which meant a host could never see their own album. The bytes are
    linked here rather than fetched through a guest route, because those authenticate a
    *guest*, and a host who never joined their own roll has no guest session to authenticate
    with. `requireHost` above is the check that matters.

    Previews, not originals: this is a two-column grid of 4:5 tiles. The full-resolution copy
    is what the download button is for.
  */
  return {
    roll: {
      id: found.id,
      code: found.code,
      name: found.name,
      coverPreset: found.coverPreset,
      coverUrl,
      startsAt: found.startsAt,
      finishesAt: found.finishesAt,
      revealAt: found.revealAt,
      revealMode: found.revealMode,
      revealDelayHours: found.revealDelayHours,
      revealedEarly: found.revealedEarly,
      everyoneCanSee: found.everyoneCanSee,
      keptUntil: found.keptUntil,
      photoCount: found._count.photos,
      guestCount: found._count.guests,
      maxGuests: found.maxGuests,
      photosPerGuest: found.photosPerGuest,
      shotsLeft,
      poolLeft: pool,
      downloadsLeft: Math.max(0, ZIP_DOWNLOAD_LIMIT - found.downloads),
    },
    /*
      Sealed rolls render the wall from `blurData` — the same ~32px inlined JPEG the guest
      album uses. It is a picture of the real photograph and nothing more: 32 pixels wide,
      under a blur, with no key that resolves to bytes and no name attached.
    */
    photos: photos.map((photo) => ({
      id: photo.id,
      by: open ? photo.guest.name : "",
      url: open ? publicUrl(photo.previewKey) : null,
      fullUrl: open ? publicUrl(photo.fullKey) : null,
      blurData: photo.blurData ?? "",
    })),
    more,
  };
}
