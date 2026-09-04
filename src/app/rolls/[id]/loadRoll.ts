import "server-only";

import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { isOpen } from "@/lib/roll-access";
import { coverUrlFor, getRollForHost } from "@/lib/rolls";
import { publicUrl } from "@/lib/storage";
import { requireHost } from "@/lib/session";

import type { BackdropPhoto, BackdropRoll } from "./RollBackdrop";

/**
 * Everything the roll screen and its three sheets need, in one place so they cannot drift.
 *
 * The photo list is loaded through the same seal the guest routes use: a closed roll returns
 * credits and placeholders but no image keys at all. Fetching the images and hiding them in
 * CSS would put them in the page source, which is not hiding them.
 */
export async function loadRoll(id: string): Promise<{
  roll: BackdropRoll;
  photos: BackdropPhoto[];
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
  const mine = await prisma.guest.findFirst({
    where: { rollId: found.id, userId: user.id },
    select: { _count: { select: { photos: true } } },
  });
  const shotsLeft = Math.max(0, found.photosPerGuest - (mine?._count.photos ?? 0));

  const photos = await prisma.photo.findMany({
    where: { rollId: found.id, status: "READY" },
    orderBy: { takenAt: "desc" },
    select: {
      id: true,
      previewKey: true,
      fullKey: true,
      blurData: true,
      guest: { select: { name: true } },
    },
  });

  /*
    The host's own grid showed gradient stand-ins and nothing else — before the reveal, which
    is right, and after it, which meant a host could never see their own album. The bytes are
    signed here rather than fetched through `/api/r/[code]/photos/[id]/full`, because that
    route authenticates a *guest*, and a host who never joined their own roll has no guest
    session to authenticate with. `requireHost` above is the check that matters.

    Previews, not originals: this is a two-column grid of 4:5 tiles. The full-resolution copy
    is what the download button is for.
  */
  const urls = open ? photos.map((photo) => publicUrl(photo.previewKey)) : [];
  // The originals, for the viewer. Same reasoning as the guest list: the host's ownership and
  // the seal are both settled above, so the viewer has nothing left to ask a route about.
  const fullUrls = open ? photos.map((photo) => publicUrl(photo.fullKey)) : [];

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
      revealedEarly: found.revealedEarly,
      everyoneCanSee: found.everyoneCanSee,
      keptUntil: found.keptUntil,
      photoCount: found._count.photos,
      guestCount: found._count.guests,
      maxGuests: found.maxGuests,
      shotsLeft,
    },
    /*
      Sealed rolls render the wall from `blurData` — the same ~32px inlined JPEG the guest
      album uses. It is a picture of the real photograph and nothing more: 32 pixels wide,
      under a blur, with no key that resolves to bytes and no name attached.
    */
    photos: photos.map((photo, index) => ({
      id: photo.id,
      by: open ? photo.guest.name : "",
      url: open ? urls[index] : null,
      fullUrl: open ? fullUrls[index] : null,
      blurData: photo.blurData,
    })),
  };
}
