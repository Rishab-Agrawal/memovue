import "server-only";

import type { RevealMode } from "@prisma/client";

import { rollCode } from "./codes";
import { CouponError, claimCoupon } from "./coupons";
import { prisma } from "./prisma";
import { computeKeptUntil, computeRevealAt, isOpen, visiblePhotoWhere } from "./roll-access";
import { purgeRoll } from "./retention";
import { coverKey, deleteObjects, presignDownload, storageConfigured } from "./storage";

/**
 * Everything that reads or writes a roll.
 *
 * Screens never touch Prisma directly: they get plain objects from here, which keeps the
 * presentational components free of database types and means changing a query does not mean
 * editing a screen.
 */

export interface CreateRollInput {
  name: string;
  startsAt: Date;
  finishesAt: Date;
  revealMode: RevealMode;
  revealDelayHours: number;
  maxGuests: number;
  photosPerGuest: number;
  everyoneCanSee: boolean;
  coverPreset: number;
  couponCode: string;
}

/**
 * Creation and coupon redemption are one transaction on purpose. Spending a code and then
 * failing to insert the roll would burn a code the host never got anything for, and there
 * is no self-serve way to give it back.
 */
export async function createRoll(hostId: string, input: CreateRollInput) {
  const revealAt = computeRevealAt(input.finishesAt, input.revealMode, input.revealDelayHours);

  try {
    return await prisma.$transaction(async (tx) => {
      const couponId = await claimCoupon(tx, input.couponCode, hostId);

      const roll = await tx.roll.create({
        data: {
          code: rollCode(),
          hostId,
          name: input.name,
          coverPreset: input.coverPreset,
          maxGuests: input.maxGuests,
          photosPerGuest: input.photosPerGuest,
          everyoneCanSee: input.everyoneCanSee,
          startsAt: input.startsAt,
          finishesAt: input.finishesAt,
          revealMode: input.revealMode,
          revealDelayHours: input.revealMode === "DELAY" ? input.revealDelayHours : 0,
          revealAt,
          keptUntil: computeKeptUntil(input.finishesAt),
        },
        select: { id: true, code: true, name: true },
      });

      await tx.coupon.update({ where: { id: couponId }, data: { rollId: roll.id } });
      return roll;
    });
  } catch (error) {
    if (error instanceof CouponError) throw error;
    throw error;
  }
}

const rollSummary = {
  id: true,
  code: true,
  name: true,
  coverPreset: true,
  coverKey: true,
  startsAt: true,
  finishesAt: true,
  revealAt: true,
  revealMode: true,
  revealedEarly: true,
  everyoneCanSee: true,
  maxGuests: true,
  photosPerGuest: true,
  keptUntil: true,
} as const;

export type RollSummary = Awaited<ReturnType<typeof getRollForHost>>;

export interface RollCard {
  id: string;
  code: string;
  name: string;
  coverPreset: number;
  coverKey: string | null;
  startsAt: Date;
  finishesAt: Date;
  photoCount: number;
  /** Null when this is the viewer's own roll; the host's name when they were invited. */
  invitedBy: string | null;
  /**
   * Up to four signed previews for the stack of prints on the home screen. Only ever filled
   * for a finished, opened album — everything else gets an empty list and draws washes.
   */
  thumbs: string[];
}

/** How many prints the album stack shows. */
const STACK = 4;

/**
 * Every roll a person is in, hosted or attended, split by whether it is still shooting.
 *
 * The two kinds are shown together rather than in a third section of their own. The split
 * that matters on this screen is time — is there still a camera, or only an album — and a
 * roll you were invited to is no less yours for the weekend than one you paid for. What
 * differs is where a card leads: your own roll opens the host screen, with its settings and
 * its invite QR; a roll you joined opens the camera, because that is all you have there.
 */
export async function listRollsForUser(userId: string) {
  const select = {
    ...rollSummary,
    _count: { select: { guests: true, photos: true } },
  } as const;

  const [hosted, joined] = await Promise.all([
    prisma.roll.findMany({
      where: { hostId: userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select,
    }),
    prisma.roll.findMany({
      // A host who also shoots their own roll has a Guest row in it, so their own rolls are
      // excluded here rather than appearing twice.
      where: {
        status: "ACTIVE",
        hostId: { not: userId },
        guests: { some: { userId } },
      },
      orderBy: { createdAt: "desc" },
      select: { ...select, host: { select: { name: true } } },
    }),
  ]);

  const cards: RollCard[] = [
    ...hosted.map((roll) => ({
      id: roll.id,
      code: roll.code,
      name: roll.name,
      coverPreset: roll.coverPreset,
      coverKey: roll.coverKey,
      startsAt: roll.startsAt,
      finishesAt: roll.finishesAt,
      photoCount: roll._count.photos,
      invitedBy: null,
      thumbs: [],
    })),
    ...joined.map((roll) => ({
      id: roll.id,
      code: roll.code,
      name: roll.name,
      coverPreset: roll.coverPreset,
      coverKey: roll.coverKey,
      startsAt: roll.startsAt,
      finishesAt: roll.finishesAt,
      photoCount: roll._count.photos,
      invitedBy: roll.host.name,
      thumbs: [],
    })),
  ].sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());

  const now = new Date();

  // "Active" on the home screen means still shooting; anything past that is an album,
  // which is why this splits on the capture window rather than on the reveal.
  const active = cards.filter((roll) => now < roll.finishesAt);
  const albums = cards.filter((roll) => now >= roll.finishesAt);

  await attachThumbs(albums, new Map([...hosted, ...joined].map((roll) => [roll.id, roll])), userId, now);

  return { active, albums };
}

/**
 * Real photographs for the album stack, in place of stock artwork.
 *
 * The stack used to be four *shipped covers*, picked by walking the preset index — so an
 * album of somebody's wedding was represented by four pictures of other people's weddings,
 * which is the one thing a photo album must never show. These are the album's own newest
 * frames, at preview size, and there are at most four of them per finished roll.
 *
 * Two rules it must not break. A sealed album gets nothing — `isOpen` is the same seal every
 * other screen asks, and a thumbnail is as much of a leak as a full frame. And on a roll the
 * viewer merely attended, `visiblePhotoWhere` narrows the stack to their own shots unless the
 * host opened the roll to everyone.
 */
async function attachThumbs(
  albums: RollCard[],
  rows: Map<string, { id: string; everyoneCanSee: boolean } & Parameters<typeof isOpen>[0]>,
  userId: string,
  now: Date,
): Promise<void> {
  if (!storageConfigured) return;

  const open = albums.filter((card) => {
    const row = rows.get(card.id);
    return row && card.photoCount > 0 && isOpen(row, now);
  });
  if (open.length === 0) return;

  // One lookup for every guest row this person holds in these rolls, rather than one per
  // card. Their own rolls do not need it — a host sees the whole album by definition.
  const guestIds = new Map(
    (
      await prisma.guest.findMany({
        where: { userId, rollId: { in: open.map((card) => card.id) } },
        select: { id: true, rollId: true },
      })
    ).map((guest) => [guest.rollId, guest.id]),
  );

  await Promise.all(
    open.map(async (card) => {
      const row = rows.get(card.id)!;
      const guestId = guestIds.get(card.id);
      // No guest row on a roll they were invited to means they never joined and shot nothing,
      // so a private album has nothing of theirs to show.
      if (card.invitedBy && !guestId) return;

      const photos = await prisma.photo.findMany({
        where: visiblePhotoWhere(
          row,
          card.invitedBy ? { kind: "guest", guestId: guestId! } : { kind: "host" },
        ),
        orderBy: [{ takenAt: "desc" }, { id: "desc" }],
        take: STACK,
        select: { previewKey: true },
      });

      card.thumbs = await Promise.all(
        photos.map((photo) => presignDownload(photo.previewKey, { expiresIn: 3600 })),
      );
    }),
  );
}

export async function getRollForHost(id: string, hostId: string) {
  return prisma.roll.findFirst({
    where: { id, hostId },
    select: {
      ...rollSummary,
      _count: { select: { guests: true, photos: true } },
    },
  });
}

/** Who has joined, and how much film each has spent. */
export async function listParticipants(rollId: string) {
  const guests = await prisma.guest.findMany({
    where: { rollId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      _count: { select: { photos: true } },
    },
  });

  return guests.map((guest) => ({
    id: guest.id,
    name: guest.name,
    shotsUsed: guest._count.photos,
  }));
}

export async function updateRollInfo(id: string, hostId: string, data: {
  name: string;
  coverPreset: number;
}) {
  await prisma.roll.updateMany({ where: { id, hostId }, data });
}

/* ------------------------------------------------------------------ covers */

/**
 * A short-lived link to the roll's own cover, or null when it is using a preset.
 *
 * Signed per render like every other image in the app, so the bucket stays private and a
 * copied cover URL stops working within the hour rather than outliving the roll.
 */
export async function coverUrlFor(roll: { coverKey: string | null }): Promise<string | null> {
  if (!roll.coverKey || !storageConfigured) return null;
  return presignDownload(roll.coverKey, { expiresIn: 3600 });
}

/** Signs a batch of covers concurrently, for screens that list rolls. */
export async function coverUrlsFor<T extends { id: string; coverKey: string | null }>(
  rolls: T[],
): Promise<Map<string, string | null>> {
  const signed = await Promise.all(rolls.map((roll) => coverUrlFor(roll)));
  return new Map(rolls.map((roll, index) => [roll.id, signed[index]]));
}

/** Adopts an already-uploaded cover. The key is recomputed here, never taken from input. */
export async function setRollCover(id: string, hostId: string): Promise<void> {
  await prisma.roll.updateMany({ where: { id, hostId }, data: { coverKey: coverKey(id) } });
}

/** Drops back to the preset gradient and removes the uploaded bytes. */
export async function clearRollCover(id: string, hostId: string): Promise<void> {
  const cleared = await prisma.roll.updateMany({
    where: { id, hostId },
    data: { coverKey: null },
  });
  if (cleared.count > 0 && storageConfigured) {
    await deleteObjects([coverKey(id)]);
  }
}

export async function updateRollVisibility(id: string, hostId: string, everyoneCanSee: boolean) {
  await prisma.roll.updateMany({ where: { id, hostId }, data: { everyoneCanSee } });
}

export async function revealRollNow(id: string, hostId: string) {
  await prisma.roll.updateMany({ where: { id, hostId }, data: { revealedEarly: true } });
}

export async function deleteRoll(id: string, hostId: string) {
  // Ownership is checked here rather than inside `purgeRoll`, which the retention job also
  // calls and which has no host to check it against.
  const owned = await prisma.roll.findFirst({ where: { id, hostId }, select: { id: true } });
  if (!owned) return;

  // Through the retention module, so a host deleting a roll by hand and the nightly sweep
  // destroy exactly the same things. This used to take back the cover and orphan every
  // photograph in the roll, while both legal documents said we delete the image files.
  await purgeRoll(id);
}

export { isOpen };
