import "server-only";

import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { isOpen } from "@/lib/roll-access";
import { coverUrlFor, getRollForHost } from "@/lib/rolls";
import { presignDownload } from "@/lib/storage";
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
  const coverUrl = await coverUrlFor(found);

  const photos = await prisma.photo.findMany({
    where: { rollId: found.id, status: "READY" },
    orderBy: { takenAt: "desc" },
    select: { id: true, previewKey: true, guest: { select: { name: true } } },
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
  const urls = open
    ? await Promise.all(photos.map((photo) => presignDownload(photo.previewKey, { expiresIn: 3600 })))
    : [];

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
    },
    // Sealed rolls still render a wall of blurred frames, so the grid needs one entry per
    // photograph — just nothing identifying inside it, and no URL that resolves to bytes.
    photos: photos.map((photo, index) => ({
      id: photo.id,
      by: open ? photo.guest.name : "",
      url: open ? urls[index] : null,
      plate: index,
    })),
  };
}
