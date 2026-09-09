import type { RevealMode } from "@prisma/client";

/**
 * Who can see a photograph, and when.
 *
 * This module is the only place that decision is made. Every route that returns image bytes,
 * signed image URLs, or a list of photos calls into here — none of them re-derives the rule.
 * That is not tidiness: the rule used to be absolute (nothing before `revealAt`, for anyone)
 * and is now conditional on two independent axes, and the way this leaks is two call sites
 * disagreeing about one of them.
 *
 * The two axes:
 *
 *   1. Is the roll OPEN? Before that moment nothing is legible to anybody — not the host,
 *      not the guest who took the shot. `DURING` rolls are open from creation, because the
 *      host chose to have no seal at all.
 *   2. Whose photo is it? Once open, `everyoneCanSee` decides whether a guest sees the whole
 *      roll or only their own frames. The host always sees all of an open roll.
 *
 * Axis 2 never overrides axis 1. `everyoneCanSee` is a statement about ownership, not about
 * the clock.
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

/**
 * The same rule as `isOpen`, written as a Prisma `where`.
 *
 * Here beside it rather than spelled out wherever open rolls are counted, because
 * `revealAt < now` is only one of its three arms: a `DURING` roll has no seal at all, and an
 * early reveal opens an album without moving the column. Counting on that column alone leaves
 * both out silently — the two-call-sites-disagreeing failure this module exists to prevent.
 */
export function openRollWhere(now: Date) {
  return {
    OR: [
      { revealedEarly: true },
      { revealMode: "DURING" as const },
      { revealAt: { lt: now } },
    ],
  };
}

/**
 * `closed` is the state the previous model could not express: shooting has finished but the
 * photos have not opened yet. It exists because capture and reveal became separate moments.
 */
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

/**
 * How long after a roll closes its photographs may still arrive.
 *
 * Taking a photo and uploading it are not the same moment. Bytes go to IndexedDB the instant
 * the shutter fires and reach the server whenever the phone next has signal, which at a venue
 * with bad wifi can be hours later and is routinely after the roll has closed.
 */
export const UPLOAD_GRACE_HOURS = 24;

/**
 * Whether an upload for this roll is still allowed in.
 *
 * Separate from `isCapturing` on purpose, and the distinction is the whole bug it fixes. The
 * reserve route used to ask `isCapturing`, so a photo taken at 11:58 and drained at 12:01 was
 * refused — and the client, correctly reading the refusal as permanent, deleted the only copy
 * of it. Ten photographs of somebody's evening were destroyed that way.
 *
 * The shutter still closes on time: the camera is gated on `isCapturing`, and a guest cannot
 * take a new photo during the grace window. This governs only whether bytes already captured
 * are allowed to finish their journey.
 */
export function acceptsUploads(roll: RollTimings, now: Date = new Date()): boolean {
  if (now.getTime() < roll.startsAt.getTime()) return false;
  return now.getTime() < roll.finishesAt.getTime() + UPLOAD_GRACE_HOURS * 3_600_000;
}

/**
 * When a photograph was actually taken, from a clock we do not control.
 *
 * The row's own timestamp is set when the shot is reserved, which is when the bytes reach us
 * rather than when the shutter fired — so a phone that was out of signal filed its evening
 * under the moment it found wifi, and with the upload grace that can be the next day. The
 * queue has known the real moment all along; it simply never sent it.
 *
 * Clamped to the capture window, because it arrives from a device whose clock is the user's to
 * set. A phone hours out of true, or someone editing the request, cannot place a photograph
 * outside the event it belongs to. Within the window it is taken at face value: a few minutes
 * of ordinary clock drift is invisible in an album ordered by time, and rejecting it would
 * throw away the only record of the order things happened in.
 */
export function takenAtWithin(claimed: Date, roll: RollTimings): Date {
  if (Number.isNaN(claimed.getTime())) return roll.finishesAt;
  if (claimed.getTime() < roll.startsAt.getTime()) return roll.startsAt;
  if (claimed.getTime() > roll.finishesAt.getTime()) return roll.finishesAt;
  return claimed;
}

/**
 * Ownership, expressed as a Prisma `where` so filtering happens in the query rather than
 * after it. The only place the rule is written.
 *
 * There was a predicate form of this too, asked a second time by `/photos/[id]/full` before
 * it redirected to the bytes. That route is gone: an image key now carries a random secret,
 * so holding the URL *is* the authorisation and there is no request left between a guest and
 * a photograph to check. The query below is what decides which rows exist at all, and a key
 * it never returned cannot be guessed.
 *
 * Deliberately says nothing about the seal: callers check `isOpen` first and return an
 * empty grid, because a sealed roll still has to render its blurred placeholders and its
 * count. Handing this a sealed roll and trusting it would publish the album.
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
  // DURING stores the close so the column is never null; `isOpen` short-circuits before
  // it is ever compared against.
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
 * What the nightly sweep should do with one roll.
 *
 * Here rather than in `retention.ts` beside the deletion itself, because that module is
 * `server-only` — it holds a Prisma client and a bucket — and this is a rule about dates that
 * wants testing without either. It sits with `computeKeptUntil`, which decides the date this
 * one reads.
 *
 * Purging is checked before warning, deliberately: a roll that shot past its date while the
 * job was switched off must still go, not fall into the warn branch and buy another week.
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
 * How long a reservation may sit unconfirmed before the sweep takes it back.
 *
 * A `PENDING` row costs its guest a shot from the moment it is written, and until now nothing
 * ever removed one — a phone that reserved and then went in a river held that shot for the
 * life of the roll. The queue gives its own reservations back the moment it decides a
 * photograph will never land; this is only for the client that never runs again.
 *
 * Well past the day-long upload grace, because a confirm is still accepted after it: a phone
 * switched off for a weekend drains on the Monday and must find its reservation still there.
 */
export const ABANDONED_UPLOAD_DAYS = 7;
