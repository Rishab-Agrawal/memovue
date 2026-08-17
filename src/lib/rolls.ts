import "server-only";

import type { RevealMode } from "@prisma/client";

import { rollCode } from "./codes";
import { CouponError, claimCoupon } from "./coupons";
import { prisma } from "./prisma";
import { computeKeptUntil, computeRevealAt, isOpen } from "./roll-access";
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

export async function listRollsForHost(hostId: string) {
  const rolls = await prisma.roll.findMany({
    where: { hostId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: {
      ...rollSummary,
      _count: { select: { guests: true, photos: true } },
    },
  });

  const now = new Date();

  // "Active" on the home screen means still shooting; anything past that is an album,
  // which is why this splits on the capture window rather than on the reveal.
  return {
    active: rolls.filter((roll) => now < roll.finishesAt),
    albums: rolls.filter((roll) => now >= roll.finishesAt),
  };
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

export async function getRollByCode(code: string) {
  return prisma.roll.findUnique({
    where: { code },
    select: { ...rollSummary, host: { select: { name: true } } },
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

/**
 * Rescheduling recomputes both derived columns. Letting `revealAt` drift from `finishesAt`
 * would leave a roll that closes on Tuesday and opens according to Monday's arithmetic.
 */
export async function updateRollSchedule(
  id: string,
  hostId: string,
  data: {
    startsAt: Date;
    finishesAt: Date;
    revealMode: RevealMode;
    revealDelayHours: number;
  },
) {
  await prisma.roll.updateMany({
    where: { id, hostId },
    data: {
      ...data,
      revealDelayHours: data.revealMode === "DELAY" ? data.revealDelayHours : 0,
      revealAt: computeRevealAt(data.finishesAt, data.revealMode, data.revealDelayHours),
      keptUntil: computeKeptUntil(data.finishesAt),
    },
  });
}

export async function revealRollNow(id: string, hostId: string) {
  await prisma.roll.updateMany({ where: { id, hostId }, data: { revealedEarly: true } });
}

export async function deleteRoll(id: string, hostId: string) {
  const deleted = await prisma.roll.deleteMany({ where: { id, hostId } });

  // The cover is the one object this module puts in the bucket, so it is the one this module
  // takes back out. Photo objects are still orphaned on delete — see KNOWN-GAPS.
  if (deleted.count > 0 && storageConfigured) {
    await deleteObjects([coverKey(id)]).catch(() => {});
  }
}

/** The count the roll header shows. Sealed rolls still report how many are waiting. */
export async function countPhotos(rollId: string) {
  return prisma.photo.count({ where: { rollId, status: "READY" } });
}

export { isOpen };
