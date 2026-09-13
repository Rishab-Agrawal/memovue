import "server-only";

import type { DeletedBy } from "@prisma/client";

import { sendDeletionNotice } from "./email";
import { prisma } from "./prisma";
import { describeRoll, rollReportSelect } from "./roll-report";
import { ABANDONED_UPLOAD_DAYS, retentionAction, WARN_BEFORE_DAYS } from "./roll-access";
import { deleteObjects, legacyZipKey, storageConfigured, zipKey } from "./storage";

/**
 * Enforces `keptUntil`. One daily pass warns a host a week before, then purges.
 *
 * Bytes always go before rows: a failure halfway leaves the row to retry tomorrow, rather than
 * objects nothing knows the keys of.
 */

const DAY = 86_400_000;

/**
 * Removes a roll and everything it owns, from the bucket and the database. Every path that
 * destroys a roll goes through here. Guests and photos cascade; a `DeletedRoll` summary is
 * written in the same transaction.
 */
export async function purgeRoll(rollId: string, deletedBy: DeletedBy): Promise<void> {
  const roll = await prisma.roll.findUniqueOrThrow({
    where: { id: rollId },
    select: { ...rollReportSelect, coverKey: true },
  });

  if (storageConfigured) {
    const photos = await prisma.photo.findMany({
      where: { rollId },
      select: { fullKey: true, previewKey: true },
    });

    const keys = [
      ...photos.flatMap((photo) => [photo.fullKey, photo.previewKey]),
      // The stored key, not a recomputed one: a roll made from another environment has another prefix.
      ...(roll.coverKey ? [roll.coverKey] : []),
      // Both archive spellings; deleting a key that was never written is free.
      zipKey(rollId),
      legacyZipKey(rollId),
    ];

    // Unguarded: if this throws, the row survives and the next pass retries.
    await deleteObjects(keys);
  }

  await prisma.$transaction([
    prisma.deletedRoll.create({
      data: {
        id: rollId,
        hostId: roll.hostId,
        deletedBy,
        createdAt: roll.createdAt,
        summary: describeRoll(roll, new Date(), false),
      },
    }),
    prisma.roll.delete({ where: { id: rollId } }),
  ]);
}

/** Every roll an account owns, bytes included. Used when the account is deleted. */
export async function purgeRollsOfHost(hostId: string): Promise<void> {
  const rolls = await prisma.roll.findMany({ where: { hostId }, select: { id: true } });
  for (const roll of rolls) await purgeRoll(roll.id, "HOST");
}

/**
 * Reservations nobody is coming back for. The queue releases its own; this is for clients that
 * never run again, whose guest would otherwise be a shot short for the life of the roll.
 */
async function purgeAbandonedUploads(now: Date): Promise<number> {
  const stale = await prisma.photo.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: new Date(now.getTime() - ABANDONED_UPLOAD_DAYS * DAY) },
    },
    select: { id: true, fullKey: true, previewKey: true },
  });
  if (stale.length === 0) return 0;

  if (storageConfigured) {
    await deleteObjects(stale.flatMap((photo) => [photo.fullKey, photo.previewKey]));
  }
  await prisma.photo.deleteMany({ where: { id: { in: stale.map((photo) => photo.id) } } });

  return stale.length;
}

interface RetentionReport {
  purged: string[];
  warned: string[];
  /** Abandoned reservations released, which is a count of shots handed back. */
  released: number;
  failed: { id: string; error: string }[];
}

/**
 * One pass. Safe to run twice in a night and safe to miss a night. One indexed read reaches a
 * week past today, and `retentionAction` sorts warnings from purges.
 */
export async function runRetention(now: Date = new Date()): Promise<RetentionReport> {
  const rolls = await prisma.roll.findMany({
    where: { keptUntil: { lte: new Date(now.getTime() + WARN_BEFORE_DAYS * DAY) } },
    select: {
      id: true,
      name: true,
      keptUntil: true,
      warnedAt: true,
      host: { select: { email: true } },
    },
    orderBy: { keptUntil: "asc" },
  });

  const report: RetentionReport = { purged: [], warned: [], released: 0, failed: [] };

  // Before the rolls, so a reservation in a roll about to be purged is not counted twice.
  try {
    report.released = await purgeAbandonedUploads(now);
  } catch (error) {
    report.failed.push({
      id: "abandoned-uploads",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  for (const roll of rolls) {
    try {
      switch (retentionAction(roll, now)) {
        case "purge":
          await purgeRoll(roll.id, "EXPIRY");
          report.purged.push(roll.id);
          break;

        case "warn":
          await sendDeletionNotice(roll.host.email, roll.name, roll.keptUntil);
          await prisma.roll.update({ where: { id: roll.id }, data: { warnedAt: now } });
          report.warned.push(roll.id);
          break;

        case "leave":
          break;
      }
    } catch (error) {
      // One bad roll must not stop the pass. It will be picked up again tomorrow.
      report.failed.push({ id: roll.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return report;
}
