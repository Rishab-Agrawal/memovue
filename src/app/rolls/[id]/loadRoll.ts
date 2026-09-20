import "server-only";

import { notFound } from "next/navigation";

import { ZIP_DOWNLOAD_LIMIT } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { isOpen } from "@/lib/roll-access";
import { sponsorFor } from "@/lib/referrals";
import { poolMoves } from "@/lib/roll-config";
import { coverUrlFor, getRollForHost, poolLeft } from "@/lib/rolls";
import { publicUrl } from "@/lib/storage";
import { requireHost } from "@/lib/session";

import type { BackdropPhoto, BackdropRoll } from "./RollBackdrop";

/** Photos on the host's wall per page: sixty rows of two. The rest is a link away. */
export const WALL_PAGE = 120;

/** What a sheet needs behind it: the backdrop is blurred and locked, so one viewport's worth. */
export const BACKDROP_PHOTOS = 8;

/**
 * Everything the roll screen and its sheets need, in one place so they cannot drift. A sealed
 * roll returns placeholders and no image keys at all.
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

  // The host's own film, counted from their Guest row like anybody else's.
  const [mine, pool, sponsor] = await Promise.all([
    prisma.guest.findFirst({
      where: { rollId: found.id, userId: user.id },
      select: { fromPool: true, refills: true, _count: { select: { photos: true } } },
    }),
    poolLeft(found),
    sponsorFor(found),
  ]);
  const shotsLeft = Math.max(
    0,
    found.photosPerGuest + (mine?.fromPool ?? 0) - (mine?._count.photos ?? 0),
  );

  // One past the page tells whether there is more. `blurData` only while sealed, when it is the tile.
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

  return {
    roll: {
      id: found.id,
      code: found.code,
      name: found.name,
      coverPreset: found.coverPreset,
      coverUrl,
      sponsor,
      startsAt: found.startsAt,
      finishesAt: found.finishesAt,
      revealAt: found.revealAt,
      revealMode: found.revealMode,
      revealDelayHours: found.revealDelayHours,
      revealedEarly: found.revealedEarly,
      everyoneCanSee: found.everyoneCanSee,
      giveawayAllowed: found.giveawayAllowed,
      keptUntil: found.keptUntil,
      photoCount: found._count.photos,
      guestCount: found._count.guests,
      maxGuests: found.maxGuests,
      photosPerGuest: found.photosPerGuest,
      shotsLeft,
      poolLeft: pool,
      // Asked with an empty camera, as the guest album asks it.
      refill: poolMoves(
        found,
        { fromPool: mine?.fromPool ?? 0, refills: mine?.refills ?? 0, shotsLeft: 0 },
        pool,
      ).take,
      downloadsLeft: Math.max(0, ZIP_DOWNLOAD_LIMIT - found.downloads),
    },
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
