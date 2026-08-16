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

export function finishDateRange(startsAt: Date): DateRange {
  const wall = toWall(startsAt);
  return {
    min: startOfWallDay(startsAt),
    max: fromWall(wall.year, wall.month + FINISH_MAX_MONTHS, wall.day),
  };
}

export function isWithin(day: Date, range: DateRange): boolean {
  const at = startOfWallDay(day).getTime();
  return at >= startOfWallDay(range.min).getTime() && at <= startOfWallDay(range.max).getTime();
}

/** Hours a host may add on top of the close before photos open. */
export const MIN_DELAY_HOURS = 1;
export const MAX_DELAY_HOURS = 72;
