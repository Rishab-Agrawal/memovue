import "server-only";

import { sendDeletionNotice } from "./email";
import { prisma } from "./prisma";
import { retentionAction, WARN_BEFORE_DAYS } from "./roll-access";
import { coverKey, deleteObjects, legacyZipKey, storageConfigured, zipKey } from "./storage";

/**
 * Making the date on a roll mean something.
 *
 * Every roll has carried a `keptUntil` since it was created, and both the host screen and
 * every guest album print it as "Photos available until…". Nothing enforced it: no roll was
 * ever deleted, every photograph any guest ever took was still sitting in the bucket, and the
 * date was a label rather than a rule. The schema was built for this job — `keptUntil` is
 * indexed and `warnedAt` has been waiting on the model — it just was never written.
 *
 * Two things happen here, both driven by one daily pass:
 *
 *   - a roll a week from its date gets its host emailed, once, recorded by `warnedAt`
 *   - a roll past its date is purged, bytes first
 *
 * Ordering inside a purge is the part worth being careful about. R2 objects go before the
 * database row, because a failure halfway leaves the roll still listed and the next night
 * tries again. Deleting the row first and then failing would strand the objects with nothing
 * left anywhere that knows their keys.
 */

const DAY = 86_400_000;

/**
 * Removes a roll and everything it owns, from the bucket as well as the database.
 *
 * Also the fix for a leak that predates the sweep: deleting a roll by hand cleaned up its
 * cover and left every photograph in it behind, and deleting an account did not touch storage
 * at all — while both documents told people we remove the image files. Every path that
 * destroys a roll goes through here now.
 *
 * Cascades take care of guests, photos and the coupon row once the roll goes.
 */
export async function purgeRoll(rollId: string): Promise<void> {
  if (storageConfigured) {
    const photos = await prisma.photo.findMany({
      where: { rollId },
      select: { fullKey: true, previewKey: true },
    });

    const keys = [
      ...photos.flatMap((photo) => [photo.fullKey, photo.previewKey]),
      // Recomputed rather than read: `coverKey` is null for a roll on a preset, and deleting
      // a key that was never written is free. The archive is the same — most rolls are never
      // downloaded and have no ZIP, and the one that does must not outlive the photographs
      // it is a copy of.
      coverKey(rollId),
      zipKey(rollId),
      // An archive built before the key carried a capability. Deleting a key that was never
      // written is free, and leaving one behind would be photographs outliving their roll.
      legacyZipKey(rollId),
    ];

    // Deliberately unguarded. If the bucket call throws, the row survives and tonight's pass
    // simply has one more roll to do than it managed.
    await deleteObjects(keys);
  }

  await prisma.roll.delete({ where: { id: rollId } });
}

/** Every roll the given account owns, bytes included. Used when an account is deleted. */
export async function purgeRollsOfHost(hostId: string): Promise<void> {
  const rolls = await prisma.roll.findMany({ where: { hostId }, select: { id: true } });
  for (const roll of rolls) await purgeRoll(roll.id);
}

export interface RetentionReport {
  purged: string[];
  warned: string[];
  failed: { id: string; error: string }[];
}

/**
 * One pass. Safe to run twice in a night and safe to miss a night.
 *
 * The query reaches a week past the horizon so warnings and purges come out of the same
 * indexed read, and `retentionAction` sorts out which is which.
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

  const report: RetentionReport = { purged: [], warned: [], failed: [] };

  for (const roll of rolls) {
    try {
      switch (retentionAction(roll, now)) {
        case "purge":
          await purgeRoll(roll.id);
          report.purged.push(roll.id);
          break;

        case "warn":
          await sendDeletionNotice(roll.host.email, roll.name, roll.keptUntil);
          // After the send, so a failed email is retried tomorrow rather than swallowed.
          // `sendDeletionNotice` never throws, though, so this is belt and braces.
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
