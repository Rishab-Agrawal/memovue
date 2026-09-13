import type { RevealMode } from "@prisma/client";

/**
 * Who can see a photograph, and when. The only place that decision is made.
 *
 *   1. Is the roll open? Before that, nothing is legible to anybody, host included.
 *      `DURING` rolls are open from creation.
 *   2. Whose photo is it? Once open, `everyoneCanSee` decides whether a guest sees the whole
 *      roll or only their own frames. The host sees all of an open roll.
 *
 * Axis 2 never overrides axis 1.
 */

export type RollPhase = "scheduled" | "capturing" | "closed" | "revealed";

export interface RollTimings {
  startsAt: Date;
  finishesAt: Date;
  revealAt: Date;
  revealMode: RevealMode;
  revealedEarly: boolean;
}

export type Viewer = { kind: "host" } | { kind: "guest"; guestId: string };

/** The seal, and nothing about ownership. */
export function isOpen(roll: RollTimings, now: Date = new Date()): boolean {
  if (roll.revealedEarly) return true;
  if (roll.revealMode === "DURING") return true;
  return now.getTime() >= roll.revealAt.getTime();
}

/** `isOpen` as a Prisma `where`. `revealAt` alone misses `DURING` and early reveals. */
export function openRollWhere(now: Date) {
  return {
    OR: [
      { revealedEarly: true },
      { revealMode: "DURING" as const },
      { revealAt: { lt: now } },
    ],
  };
}

/** `closed`: shooting has finished but the photos have not opened yet. */
export function rollPhase(roll: RollTimings, now: Date = new Date()): RollPhase {
  if (isOpen(roll, now)) return "revealed";
  if (now.getTime() < roll.startsAt.getTime()) return "scheduled";
  if (now.getTime() < roll.finishesAt.getTime()) return "capturing";
  return "closed";
}

/** Whether guests may still spend shots. This is what closes the shutter. */
export function isCapturing(roll: RollTimings, now: Date = new Date()): boolean {
  return (
    now.getTime() >= roll.startsAt.getTime() && now.getTime() < roll.finishesAt.getTime()
  );
}

/** How long after a roll closes its queued photographs may still arrive. */
export const UPLOAD_GRACE_HOURS = 24;

/**
 * Whether an upload for this roll is still allowed in. Outlives `isCapturing`: a photo taken at
 * 11:58 on bad wifi drains after the close, and refusing it makes the queue delete the only copy.
 */
export function acceptsUploads(roll: RollTimings, now: Date = new Date()): boolean {
  if (now.getTime() < roll.startsAt.getTime()) return false;
  return now.getTime() < roll.finishesAt.getTime() + UPLOAD_GRACE_HOURS * 3_600_000;
}

/** A device-reported shutter time, clamped to the capture window since the clock is the user's. */
export function takenAtWithin(claimed: Date, roll: RollTimings): Date {
  if (Number.isNaN(claimed.getTime())) return roll.finishesAt;
  if (claimed.getTime() < roll.startsAt.getTime()) return roll.startsAt;
  if (claimed.getTime() > roll.finishesAt.getTime()) return roll.finishesAt;
  return claimed;
}

/**
 * Ownership as a Prisma `where`. The only place the rule is written.
 *
 * Says nothing about the seal: callers check `isOpen` first, because a sealed roll still renders
 * its blurred placeholders. Handing this a sealed roll and trusting it would publish the album.
 */
export function visiblePhotoWhere(
  roll: { id: string; everyoneCanSee: boolean },
  viewer: Viewer,
): { rollId: string; status: "READY"; guestId?: string } {
  const base = { rollId: roll.id, status: "READY" as const };
  if (viewer.kind === "host" || roll.everyoneCanSee) return base;
  return { ...base, guestId: viewer.guestId };
}

/** Derived on every write, never accepted from input. */
export function computeRevealAt(
  finishesAt: Date,
  mode: RevealMode,
  delayHours: number,
): Date {
  if (mode === "DELAY") return new Date(finishesAt.getTime() + delayHours * 3_600_000);
  // DURING stores the close so the column is never null; `isOpen` never compares it.
  return new Date(finishesAt);
}

/** Photos live 30 days past the close, then the retention job removes them. */
const RETENTION_DAYS = 30;

export function computeKeptUntil(finishesAt: Date): Date {
  return new Date(finishesAt.getTime() + RETENTION_DAYS * 24 * 3_600_000);
}

/** How long before a roll's `keptUntil` its host is emailed about it. */
export const WARN_BEFORE_DAYS = 7;

type RetentionAction = "purge" | "warn" | "leave";

/**
 * What the nightly sweep does with one roll. Here rather than in the server-only `retention.ts`
 * so it can be tested without a database. Purge is checked first, so a roll that slipped past
 * its date while the job was off still goes.
 */
export function retentionAction(
  roll: { keptUntil: Date; warnedAt: Date | null },
  now: Date,
): RetentionAction {
  if (roll.keptUntil.getTime() <= now.getTime()) return "purge";
  if (roll.warnedAt) return "leave";
  if (roll.keptUntil.getTime() - now.getTime() <= WARN_BEFORE_DAYS * 86_400_000) return "warn";
  return "leave";
}

/**
 * How long an unconfirmed reservation holds its shot before the sweep takes it back. Well past
 * the upload grace, because a phone switched off for a weekend must still find it on Monday.
 */
export const ABANDONED_UPLOAD_DAYS = 7;
