import "server-only";

import type { DeletedBy } from "@prisma/client";

import { sendDeletionNotice } from "./email";
import { prisma } from "./prisma";
import { describeRoll, rollReportSelect } from "./roll-report";
import { ABANDONED_UPLOAD_DAYS, retentionAction, WARN_BEFORE_DAYS } from "./roll-access";
import { deleteObjects, legacyZipKey, storageConfigured, zipKey } from "./storage";

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
 * Cascades take care of guests and photos once the roll goes. What stays is a `DeletedRoll`,
 * written in the same transaction as the delete so a roll can never go without one.
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
      /*
        The cover as it was actually written, not as this process would write it.

        It used to be recomputed from the roll id, and `storage.ts` builds every key under a
        prefix chosen by NODE_ENV — `events` in production, `dev` everywhere else. That is
        only safe while one database is only ever reached by one of those, which was not
        true: a roll created against the shared database from a laptop stored its cover at
        `dev/covers/…`, and the production sweep asked the bucket to delete
        `events/covers/…`. The object survived its own roll's deletion, invisible to
        everything that could have found it again, and billed for as long as the bucket
        lives. The column has been there since the first migration.
      */
      ...(roll.coverKey ? [roll.coverKey] : []),
      // The archive stays derived — it is a pure function of the roll, most rolls never have
      // one, and deleting a key that was never written is free. Both spellings, because a
      // roll may carry one built before the key became a capability, and photographs must not
      // outlive the roll they were taken on.
      zipKey(rollId),
      legacyZipKey(rollId),
    ];

    // Deliberately unguarded. If the bucket call throws, the row survives and tonight's pass
    // simply has one more roll to do than it managed.
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

/**
 * Every roll the given account owns, bytes included. Used when an account is deleted — whose
 * user row goes a line later and takes these `DeletedRoll`s with it, by cascade.
 */
export async function purgeRollsOfHost(hostId: string): Promise<void> {
  const rolls = await prisma.roll.findMany({ where: { hostId }, select: { id: true } });
  for (const roll of rolls) await purgeRoll(roll.id, "HOST");
}

/**
 * Reservations nobody is ever coming back for.
 *
 * A `PENDING` row spends its guest's shot the moment it is written, and nothing has ever
 * taken one back — the schema said so out loud, and the index it needed was already there.
 * The queue releases its own the instant it decides a photograph will never land; this is for
 * the client that simply never runs again, whose guest is otherwise short a shot for the life
 * of the roll and whose half-uploaded bytes sit in the bucket unnamed by any row.
 *
 * Bytes first, as everywhere else here: a throw leaves the rows behind and tomorrow retries,
 * rather than stranding objects nothing knows the keys of.
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

  const report: RetentionReport = { purged: [], warned: [], released: 0, failed: [] };

  // Before the rolls, so a reservation inside one that is about to be purged is not counted
  // twice. Its own try/catch for the same reason every roll below has one.
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
