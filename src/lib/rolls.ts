import "server-only";

import type { RevealMode } from "@prisma/client";

import { type Account, refundRoll, spendRoll } from "./beta";
import { rollCode } from "./codes";
import { prisma } from "./prisma";
import { computeKeptUntil, computeRevealAt, isOpen, visiblePhotoWhere } from "./roll-access";
import { clampFinish, earliestFinish, movedStart, poolFrom } from "./roll-config";
import { purgeRoll } from "./retention";
import { coverKey, deleteObjects, publicUrl, storageConfigured, zipKey } from "./storage";

/**
 * Everything that reads or writes a roll. Screens get plain objects from here and never touch
 * Prisma directly.
 */

/**
 * A photograph counts once it has landed. Only quota counts `PENDING` reservations, and that is
 * asked in `guest-context`.
 */
const photoCount = { where: { status: "READY" } } as const;

/** The unclaimed film in one roll, right now. */
export async function poolLeft(roll: {
  id: string;
  maxGuests: number;
  photosPerGuest: number;
}): Promise<number> {
  const { _count, _sum } = await prisma.guest.aggregate({
    where: { rollId: roll.id },
    _count: true,
    _sum: { fromPool: true },
  });
  return poolFrom(roll, _count, _sum.fromPool ?? 0);
}

interface CreateRollInput {
  name: string;
  startsAt: Date;
  finishesAt: Date;
  revealMode: RevealMode;
  revealDelayHours: number;
  maxGuests: number;
  photosPerGuest: number;
  everyoneCanSee: boolean;
  giveawayAllowed: boolean;
  uploadsAllowed: boolean;
  coverPreset: number;
  /** The business whose referral code was typed into the wizard, already resolved to a row. */
  referrerId?: string | null;
}

/**
 * Postgres refusing a duplicate roll code, and nothing else. Narrow so a `BetaAccessError` is
 * never retried into spending a second roll.
 */
function isCodeTaken(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ((error as { code?: unknown }).code !== "P2002") return false;
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  return Array.isArray(target) ? target.includes("code") : target === "code";
}

/**
 * A roll, and the allowance it is created against.
 *
 * Retried up to three times on a code collision. The whole transaction is retried, because a
 * constraint violation aborts it — and the rollback is what hands the allowance back.
 */
export async function createRoll(host: Account & { name: string }, input: CreateRollInput) {
  const revealAt = computeRevealAt(input.finishesAt, input.revealMode, input.revealDelayHours);

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await writeRoll(host, input, revealAt);
    } catch (error) {
      if (attempt >= 2 || !isCodeTaken(error)) throw error;
    }
  }
}

/** One transaction, so an allowance is never spent without a roll to show for it. */
function writeRoll(host: Account & { name: string }, input: CreateRollInput, revealAt: Date) {
  return prisma.$transaction(async (tx) => {
    await spendRoll(tx, host);

    const roll = await tx.roll.create({
      data: {
        code: rollCode(),
        hostId: host.id,
        name: input.name,
        coverPreset: input.coverPreset,
        referrerId: input.referrerId ?? null,
        maxGuests: input.maxGuests,
        photosPerGuest: input.photosPerGuest,
        everyoneCanSee: input.everyoneCanSee,
        giveawayAllowed: input.giveawayAllowed,
        uploadsAllowed: input.uploadsAllowed,
        startsAt: input.startsAt,
        finishesAt: input.finishesAt,
        revealMode: input.revealMode,
        revealDelayHours: input.revealMode === "DELAY" ? input.revealDelayHours : 0,
        revealAt,
        keptUntil: computeKeptUntil(input.finishesAt),
      },
      select: { id: true, code: true, name: true },
    });

    // The host shoots like anybody else, so they are a guest of their own roll from the start.
    await tx.guest.create({
      data: { rollId: roll.id, name: host.name, userId: host.id },
    });

    return roll;
  });
}

const rollSummary = {
  id: true,
  code: true,
  name: true,
  coverPreset: true,
  coverKey: true,
  coverVersion: true,
  referrerId: true,
  startsAt: true,
  finishesAt: true,
  firstShotAt: true,
  revealAt: true,
  revealMode: true,
  revealDelayHours: true,
  revealedEarly: true,
  everyoneCanSee: true,
  giveawayAllowed: true,
  uploadsAllowed: true,
  maxGuests: true,
  photosPerGuest: true,
  keptUntil: true,
  downloads: true,
} as const;

export interface RollCard {
  id: string;
  code: string;
  name: string;
  coverPreset: number;
  coverKey: string | null;
  coverVersion: number;
  startsAt: Date;
  finishesAt: Date;
  photoCount: number;
  /** Null when this is the viewer's own roll; the host's name when they were invited. */
  invitedBy: string | null;
  /** Up to four previews for the album stack. Only filled for a finished, opened album. */
  thumbs: string[];
}

/** How many prints the album stack shows. */
const STACK = 4;

function toCard(
  roll: {
    id: string;
    code: string;
    name: string;
    coverPreset: number;
    coverKey: string | null;
    coverVersion: number;
    startsAt: Date;
    finishesAt: Date;
    _count: { photos: number };
  },
  invitedBy: string | null,
): RollCard {
  return {
    id: roll.id,
    code: roll.code,
    name: roll.name,
    coverPreset: roll.coverPreset,
    coverKey: roll.coverKey,
    coverVersion: roll.coverVersion,
    startsAt: roll.startsAt,
    finishesAt: roll.finishesAt,
    photoCount: roll._count.photos,
    invitedBy,
    thumbs: [],
  };
}

/**
 * Every roll a person is in, hosted or attended, split by whether it is still shooting. Your
 * own roll opens the host screen; one you joined opens the camera.
 */
export async function listRollsForUser(userId: string, { thumbs = true } = {}) {
  const select = {
    ...rollSummary,
    _count: { select: { guests: true, photos: photoCount } },
  } as const;

  const [hosted, joined] = await Promise.all([
    prisma.roll.findMany({
      where: { hostId: userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select,
    }),
    prisma.roll.findMany({
      // The host has a Guest row in their own roll, so it is excluded here rather than doubled.
      where: {
        status: "ACTIVE",
        hostId: { not: userId },
        guests: { some: { userId } },
      },
      orderBy: { createdAt: "desc" },
      select: { ...select, host: { select: { name: true } } },
    }),
  ]);

  const cards = [
    ...hosted.map((roll) => toCard(roll, null)),
    ...joined.map((roll) => toCard(roll, roll.host.name)),
  ].sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());

  const now = new Date();
  const active = cards.filter((roll) => now < roll.finishesAt);
  const albums = cards.filter((roll) => now >= roll.finishesAt);

  // One photo query per open album, so only for screens that draw them.
  if (thumbs) {
    await attachThumbs(albums, new Map([...hosted, ...joined].map((roll) => [roll.id, roll])), userId, now);
  }

  return { active, albums };
}

/**
 * The album's own newest frames for its stack. A sealed album gets nothing, and on a roll the
 * viewer only attended, `visiblePhotoWhere` narrows the stack to what they may see.
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

  // One lookup for every guest row this person holds in these rolls.
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
      // Invited but never joined: nothing of theirs to show.
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

      card.thumbs = photos.map((photo) => publicUrl(photo.previewKey));
    }),
  );
}

export async function getRollForHost(id: string, hostId: string) {
  return prisma.roll.findFirst({
    where: { id, hostId },
    select: {
      ...rollSummary,
      _count: { select: { guests: true, photos: photoCount } },
    },
  });
}

/** Who is on this roll and how much film each has spent. The host is flagged, not hidden. */
export async function listParticipants(rollId: string) {
  const guests = await prisma.guest.findMany({
    where: { rollId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      roll: { select: { hostId: true } },
      userId: true,
      _count: { select: { photos: photoCount } },
    },
  });

  return guests.map((guest) => ({
    id: guest.id,
    name: guest.name,
    shotsUsed: guest._count.photos,
    isHost: guest.userId !== null && guest.userId === guest.roll.hostId,
  }));
}

/* ------------------------------------------------------------------ moving the window */

/**
 * A new closing time for a roll that has not opened yet. `revealAt` and `keptUntil` move with
 * it, and `warnedAt` resets because it warned about a date that no longer exists.
 *
 * Never into the past: on an `AFTER` roll the close is the reveal, so a backdated finish would
 * unseal the album.
 */
export async function updateRollFinish(
  id: string,
  hostId: string,
  finishesAt: Date,
): Promise<boolean> {
  const roll = await prisma.roll.findFirst({
    where: { id, hostId },
    select: {
      startsAt: true,
      finishesAt: true,
      revealAt: true,
      revealMode: true,
      revealDelayHours: true,
      revealedEarly: true,
    },
  });
  if (!roll || isOpen(roll)) return false;

  const floor = Math.max(earliestFinish(roll.startsAt).getTime(), Date.now());
  const closes = clampFinish(roll.startsAt, new Date(Math.max(finishesAt.getTime(), floor)));

  await prisma.roll.update({
    where: { id },
    data: {
      finishesAt: closes,
      revealAt: computeRevealAt(closes, roll.revealMode, roll.revealDelayHours),
      keptUntil: computeKeptUntil(closes),
      warnedAt: null,
    },
  });
  return true;
}

/**
 * A new opening time, for a roll whose event has not begun. `movedStart` is the rule, shared
 * with the settings preview; this applies its consequences like `updateRollFinish`.
 */
export async function updateRollStart(
  id: string,
  hostId: string,
  startsAt: Date,
): Promise<boolean> {
  const roll = await prisma.roll.findFirst({
    where: { id, hostId },
    select: {
      startsAt: true,
      finishesAt: true,
      revealMode: true,
      revealDelayHours: true,
    },
  });
  if (!roll) return false;

  const moved = movedStart(roll, startsAt);
  if (!moved) return false;

  await prisma.roll.update({
    where: { id },
    data: {
      startsAt: moved.startsAt,
      finishesAt: moved.finishesAt,
      revealAt: computeRevealAt(moved.finishesAt, roll.revealMode, roll.revealDelayHours),
      keptUntil: computeKeptUntil(moved.finishesAt),
      warnedAt: null,
    },
  });
  return true;
}

/* ------------------------------------------------------------------ how big a roll is */

type SizeResult = "ok" | "not-found" | "below-joined";

/**
 * How many people a roll holds and how much film each gets. Either may move either way, except
 * below the number of guests already in. Lowering shots takes nothing away: `shotsLeft` floors
 * at zero.
 *
 * ponytail: free while `BETA`. Whatever takes payments has to come through here.
 */
export async function setRollSize(
  id: string,
  hostId: string,
  next: { maxGuests?: number; photosPerGuest?: number },
): Promise<SizeResult> {
  const roll = await prisma.roll.findFirst({
    where: { id, hostId },
    select: { _count: { select: { guests: true } } },
  });
  if (!roll) return "not-found";
  if (next.maxGuests !== undefined && next.maxGuests < roll._count.guests) return "below-joined";

  await prisma.roll.update({ where: { id }, data: next });
  return "ok";
}

/* ------------------------------------------------------------------ taking things out */

/** Bytes for photographs that are leaving, and the cached ZIP that still contains them. */
async function dropPhotoObjects(
  rollId: string,
  photos: { fullKey: string; previewKey: string }[],
): Promise<void> {
  if (!storageConfigured || photos.length === 0) return;
  await deleteObjects([
    ...photos.flatMap((photo) => [photo.fullKey, photo.previewKey]),
    zipKey(rollId),
  ]);
}

/**
 * One photograph out of the album, by the host. Not the guest: un-taking a shot would refund
 * quota and let them shoot indefinitely.
 */
export async function deleteRollPhoto(
  rollId: string,
  hostId: string,
  photoId: string,
): Promise<boolean> {
  const owned = await prisma.roll.findFirst({ where: { id: rollId, hostId }, select: { id: true } });
  if (!owned) return false;

  const photo = await prisma.photo.findFirst({
    where: { id: photoId, rollId },
    select: { id: true, fullKey: true, previewKey: true },
  });
  if (!photo) return false;

  // Bytes first: a failure leaves a row that can be retried, not objects nothing can find.
  await dropPhotoObjects(rollId, [photo]);
  await prisma.photo.delete({ where: { id: photo.id } });
  return true;
}

/**
 * A guest out of the roll, with everything they shot. The photo rows cascade; the objects do
 * not, so they are deleted here. Never the host.
 */
export async function removeGuest(
  rollId: string,
  hostId: string,
  guestId: string,
): Promise<boolean> {
  const owned = await prisma.roll.findFirst({ where: { id: rollId, hostId }, select: { id: true } });
  if (!owned) return false;

  const target = await prisma.guest.findFirst({
    where: { id: guestId, rollId },
    select: { userId: true },
  });
  if (!target || target.userId === hostId) return false;

  const photos = await prisma.photo.findMany({
    where: { guestId, rollId },
    select: { fullKey: true, previewKey: true },
  });
  await dropPhotoObjects(rollId, photos);

  const removed = await prisma.guest.deleteMany({ where: { id: guestId, rollId } });
  return removed.count > 0;
}

/** The plain settings a host can flip at any time. */
export async function updateRollFields(
  id: string,
  hostId: string,
  data: Partial<{
    name: string;
    coverPreset: number;
    everyoneCanSee: boolean;
    /** Closing it takes nothing back: film already in the pool stays there. */
    giveawayAllowed: boolean;
  }>,
) {
  await prisma.roll.updateMany({ where: { id, hostId }, data });
}

/** Allowing uploads unsettles the album, so the ZIP built from it goes. See `acceptsUploads`. */
export async function setRollUploads(id: string, hostId: string, uploadsAllowed: boolean) {
  const { count } = await prisma.roll.updateMany({ where: { id, hostId }, data: { uploadsAllowed } });
  if (count && uploadsAllowed && storageConfigured) await deleteObjects([zipKey(id)]);
}

/* ------------------------------------------------------------------ covers */

/**
 * The roll's own cover, or null when it is using a preset. A stable URL so the edge and the
 * browser cache it; `?v=` changes it when the cover is replaced at the same key.
 */
export function coverUrlFor(roll: {
  coverKey: string | null;
  coverVersion: number;
}): string | null {
  if (!roll.coverKey || !storageConfigured) return null;
  return `${publicUrl(roll.coverKey)}?v=${roll.coverVersion}`;
}

/**
 * Adopts an already-uploaded cover. The key is recomputed, never taken from input, and the
 * version bumps on every adoption because the key itself never changes.
 */
export async function setRollCover(id: string, hostId: string): Promise<void> {
  await prisma.roll.updateMany({
    where: { id, hostId },
    data: { coverKey: coverKey(id), coverVersion: { increment: 1 } },
  });
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

/**
 * Moving the reveal of a roll that is still sealed. Choosing `DURING` is how a roll opens early.
 *
 * `revealedEarly` is set alongside, so picking `AFTER` again later cannot re-seal photographs
 * guests have already seen.
 */
export async function updateRollReveal(
  id: string,
  hostId: string,
  revealMode: RevealMode,
  delayHours: number,
): Promise<boolean> {
  const roll = await prisma.roll.findFirst({
    where: { id, hostId },
    select: {
      startsAt: true,
      finishesAt: true,
      revealAt: true,
      revealMode: true,
      revealedEarly: true,
    },
  });
  if (!roll || isOpen(roll)) return false;

  const hours = revealMode === "DELAY" ? delayHours : 0;
  await prisma.roll.update({
    where: { id },
    data: {
      revealMode,
      revealDelayHours: hours,
      revealAt: computeRevealAt(roll.finishesAt, revealMode, hours),
      revealedEarly: revealMode === "DURING",
    },
  });
  return true;
}

export async function deleteRoll(id: string, hostId: string) {
  // Ownership is checked here: `purgeRoll` is shared with the sweep, which has no host.
  const owned = await prisma.roll.findFirst({
    where: { id, hostId },
    select: {
      id: true,
      startsAt: true,
      host: { select: { id: true, email: true, role: true } },
    },
  });
  if (!owned) return;

  // Through retention, so a manual delete and the nightly sweep destroy exactly the same things.
  await purgeRoll(id, "HOST");

  // The allowance comes back only for a roll that never started, and only after the purge.
  if (owned.startsAt > new Date()) await refundRoll(owned.host);
}
