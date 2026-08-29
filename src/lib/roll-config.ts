import { fromWall, startOfWallDay, toWall } from "./format";

/**
 * The shape a host can give a roll: how many people, how many shots each, how far ahead it
 * can be scheduled, and what that costs.
 *
 * Client-safe — no secrets, no server imports — because the wizard renders these and the
 * server validates against the same values. Two lists that have to agree is a bug waiting
 * to happen; one list read from both ends cannot drift.
 */

/** Participant caps, in the order the eight boxes appear on the guests step. */
export const PARTICIPANT_TIERS = [5, 10, 25, 50, 100, 200, 350, 500] as const;

/** Shots per person, in the order the six chips appear. There is no unlimited option. */
export const SHOT_TIERS = [5, 10, 16, 24, 36, 100] as const;

/**
 * Placeholder rupee pricing, and deliberately two small arrays rather than a 48-cell table:
 * fourteen numbers to tune, and every combination still gets its own price. The reference
 * app charged on participants alone; ours has to move with shot count too, because shots are
 * what actually cost us storage.
 */
const PARTICIPANT_BASE = [0, 199, 399, 749, 1299, 2299, 3699, 4999];
const SHOT_MULTIPLIER = [0.6, 0.75, 0.9, 1, 1.25, 2];

export function priceFor(participantIndex: number, shotIndex: number): number {
  const base = PARTICIPANT_BASE[participantIndex] ?? 0;
  if (base === 0) return 0;
  const multiplier = SHOT_MULTIPLIER[shotIndex] ?? 1;
  return Math.round((base * multiplier) / 10) * 10;
}

export function formatPrice(rupees: number): string {
  if (rupees === 0) return "Free";
  return `₹${rupees.toLocaleString("en-IN")}`;
}

/* ------------------------------------------------------------------ the calendar */

/** Weddings get booked years ahead, so the window is generous. Settings can still move it. */
export const START_MAX_YEARS = 2;

/** A roll that runs longer than two months is a mistake, not a plan. */
export const FINISH_MAX_MONTHS = 2;

/**
 * The shortest a roll may run.
 *
 * Without a floor the finish only had to differ from the start, and since the calendar and
 * the clock are picked separately a host could set a 3am start and a 2am finish on the same
 * day and get a roll that closed before it opened. Half an hour is short enough never to
 * obstruct a real event and long enough that anything under it is a slip.
 */
export const MIN_ROLL_MINUTES = 30;

/** The first instant a roll starting at `startsAt` is allowed to close. */
export function earliestFinish(startsAt: Date): Date {
  return new Date(startsAt.getTime() + MIN_ROLL_MINUTES * 60_000);
}

export interface DateRange {
  min: Date;
  max: Date;
}

/** Bounds are wall-clock days in the app's zone, matching what the calendar draws. */
export function startDateRange(now: Date = new Date()): DateRange {
  const wall = toWall(now);
  return {
    min: startOfWallDay(now),
    max: fromWall(wall.year + START_MAX_YEARS, wall.month, wall.day),
  };
}

/**
 * Days on which a roll starting at `startsAt` may close.
 *
 * The floor is the day of the *earliest permitted finish*, not the day of the start. Those
 * differ for a roll starting in the last half hour before midnight: a 23:50 start cannot
 * close on its own day at all, so that day is not offered.
 */
export function finishDateRange(startsAt: Date): DateRange {
  const wall = toWall(startsAt);
  return {
    min: startOfWallDay(earliestFinish(startsAt)),
    max: fromWall(wall.year, wall.month + FINISH_MAX_MONTHS, wall.day),
  };
}

export function isWithin(day: Date, range: DateRange): boolean {
  const at = startOfWallDay(day).getTime();
  return at >= startOfWallDay(range.min).getTime() && at <= startOfWallDay(range.max).getTime();
}

/**
 * A finish that still fits around its start, given one that may no longer.
 *
 * Editing the start after the finish can invalidate it from either end — moving it forward
 * past the finish, or back so far that the finish breaks the two-month ceiling. The wizard
 * runs this whenever the start moves so the pair it carries is always a legal one, rather
 * than letting the host discover it at the coupon dialog after six screens.
 */
export function clampFinish(startsAt: Date, finishesAt: Date): Date {
  const earliest = earliestFinish(startsAt);
  if (finishesAt.getTime() < earliest.getTime()) return earliest;

  const range = finishDateRange(startsAt);
  if (!isWithin(finishesAt, range)) {
    // Keep the time of day the host chose and pull the date back onto the last legal one.
    const last = toWall(range.max);
    const kept = toWall(finishesAt);
    return fromWall(last.year, last.month, last.day, kept.hour, kept.minute);
  }

  return finishesAt;
}

/** Hours a host may add on top of the close before photos open. */
export const MIN_DELAY_HOURS = 1;
export const MAX_DELAY_HOURS = 72;

/* ------------------------------------------------------------------ visibility */

/**
 * The two states of the one switch a host can flip after a roll exists, worded once.
 *
 * The wizard and the settings sheet had their own copies, and the settings sheet's was not a
 * pair at all — it hardcoded the "on" wording as a static row label, so turning visibility off
 * left the screen still reading "Everyone can see all photos" underneath a switch that was
 * plainly off. A label that does not move is worse than no label: it is a wrong one.
 */
export const VISIBILITY_LABEL = {
  on: "Everyone can see all photos",
  off: "Only host can see all photos",
} as const;

export function visibilityLabel(everyoneCanSee: boolean): string {
  return everyoneCanSee ? VISIBILITY_LABEL.on : VISIBILITY_LABEL.off;
}
