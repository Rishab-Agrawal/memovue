import "server-only";

import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { isOpen } from "@/lib/roll-access";
import { coverUrlFor, getRollForHost } from "@/lib/rolls";
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
    select: { id: true, guest: { select: { name: true } } },
  });

  return {
    roll: {
      id: found.id,
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
    // photograph — just nothing identifying inside it.
    photos: photos.map((photo, index) => ({
      id: photo.id,
      by: open ? photo.guest.name : "",
      plate: index,
    })),
  };
}
