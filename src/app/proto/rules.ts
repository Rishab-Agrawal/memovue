/**
 * Every rule the prototype's screens depend on, kept apart from the data so a screen can be
 * re-pointed at different mock values without changing behaviour.
 */

export type RevealMode = "during" | "after" | "delay";

/** Participant caps, in the order the eight boxes appear on the guests step. */
export const PARTICIPANT_TIERS = [5, 10, 25, 50, 100, 200, 350, 500] as const;

/** Shots per person, in the order the six chips appear. No infinity option. */
export const SHOT_TIERS = [5, 10, 16, 24, 36, 100] as const;

/**
 * Placeholder rupee pricing. Real numbers are not decided yet, so this is deliberately two
 * small arrays rather than a 48-cell table: fourteen numbers to tune, and every combination
 * still gets its own price. The reference app charged per participant only; ours has to
 * move with shot count too, because shots are what actually cost us storage.
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

export interface DateRange {
  min: Date;
  max: Date;
}

/** Weddings get booked years ahead, so the window is generous. Settings can still move it. */
export function startDateRange(now: Date): DateRange {
  const max = new Date(now);
  max.setUTCFullYear(max.getUTCFullYear() + 2);
  return { min: startOfDay(now), max: startOfDay(max) };
}

/** A film that runs longer than two months is a mistake, not a plan. */
export function finishDateRange(startAt: Date): DateRange {
  const max = new Date(startAt);
  max.setUTCMonth(max.getUTCMonth() + 2);
  return { min: startOfDay(startAt), max: startOfDay(max) };
}

/** UTC, like everything else here — see the note in `format.ts`. */
function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export function isWithin(day: Date, range: DateRange): boolean {
  const at = startOfDay(day).getTime();
  return at >= startOfDay(range.min).getTime() && at <= startOfDay(range.max).getTime();
}

/** `during` films have no reveal moment — the photos were never sealed. */
export function revealAt(finishAt: Date, mode: RevealMode, delayHours: number): Date | null {
  if (mode === "during") return null;
  if (mode === "after") return new Date(finishAt);
  return new Date(finishAt.getTime() + delayHours * 3_600_000);
}

/**
 * "7h 32m", with no trailing word. Needed on its own because the same span is read three
 * ways — "7h 32m left", "Reveals in 7h 32m", and bare under the word "Left" on the film
 * header. Baking "left" into the only formatter produced "Reveals in 7h 32m left".
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "Ended";

  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) return `${days}d ${hours % 24}h`;
  if (hours >= 1) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return "Ended";
  return `${formatDuration(msRemaining)} left`;
}
