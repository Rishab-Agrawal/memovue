/**
 * Date, time and duration display.
 *
 * Everything is stored as an instant and shown in **Asia/Kolkata**, a fixed +05:30 with no DST.
 * Pinned rather than read from the browser, so server and client render identically; and the
 * wall-clock helpers are exact arithmetic, so the picker and the formatter agree on "6 PM".
 */
const ZONE = "Asia/Kolkata";
const LOCALE = "en-GB";
const OFFSET_MINUTES = 330;

/** Our own month names: CLDR's "Sept" breaks alignment and changes with the runtime's ICU. */
export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thur", "Fri", "Sat"] as const;

function parts(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: ZONE, ...options }).format(date);
}

/* ------------------------------------------------------------------ wall clock */

export interface Wall {
  year: number;
  month: number; // 0-indexed, like Date
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

/** The calendar fields a person in India would read off a clock. */
export function toWall(date: Date): Wall {
  const shifted = new Date(date.getTime() + OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** The instant those fields describe. */
export function fromWall(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) - OFFSET_MINUTES * 60_000);
}

/** Midnight in Kolkata on the day this instant falls on. */
export function startOfWallDay(date: Date): Date {
  const wall = toWall(date);
  return fromWall(wall.year, wall.month, wall.day);
}

/**
 * The wall-clock date as `YYYY-MM-DD`. A string, because node-postgres would shift a JS Date by
 * the process's zone on the way into a `date` column. `Metric` is keyed on it.
 */
export function wallDate(date: Date): string {
  const { year, month, day } = toWall(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The half-open instant range `[from, to)` that a `YYYY-MM-DD` covers in Kolkata. */
export function wallDateRange(date: string): { from: Date; to: Date } {
  const [year, month, day] = date.split("-").map(Number);
  const from = fromWall(year, month - 1, day);
  return { from, to: new Date(from.getTime() + 86_400_000) };
}

export function sameWallDay(a: Date, b: Date): boolean {
  const x = toWall(a);
  const y = toWall(b);
  return x.year === y.year && x.month === y.month && x.day === y.day;
}

/*
  A date picker's two edits, rebuilt from wall-clock fields. Not `setUTCHours`: Kolkata midnight
  is 18:30 UTC the previous day, so a UTC hour written onto it lands on yesterday.
*/

/** The time of day from `value`, moved onto the wall-clock day that `day` falls on. */
export function withWallDay(value: Date, day: Date): Date {
  const target = toWall(day);
  const { hour, minute } = toWall(value);
  return fromWall(target.year, target.month, target.day, hour, minute);
}

/** The wall-clock day from `value`, at a new wall-clock time. */
export function withWallTime(value: Date, hour: number, minute: number): Date {
  const { year, month, day } = toWall(value);
  return fromWall(year, month, day, hour, minute);
}

/** Days in a month, and which weekday it opens on — what a calendar grid needs. */
export function monthGrid(year: number, month: number) {
  return {
    firstWeekday: toWall(fromWall(year, month, 1)).weekday,
    days: toWall(fromWall(year, month + 1, 0)).day,
  };
}

/* ------------------------------------------------------------------ display */

/** "12 Sep" */
export function formatDay(date: Date): string {
  const wall = toWall(date);
  return `${wall.day} ${MONTHS[wall.month]}`;
}

/** "12 Sep 2026" */
export function formatDayYear(date: Date): string {
  const wall = toWall(date);
  return `${wall.day} ${MONTHS[wall.month]} ${wall.year}`;
}

/** "6:00 pm" */
export function formatTime(date: Date): string {
  return parts(date, { hour: "numeric", minute: "2-digit", hour12: true });
}

/** "12 Sep 2026 at 6:00 pm" — the value on a settings row. */
export function formatDateTime(date: Date): string {
  return `${formatDayYear(date)} at ${formatTime(date)}`;
}

/** "12 Sep at 6:00 pm" — the reveal chip, which has less room. */
export function formatShortDateTime(date: Date): string {
  return `${formatDay(date)} at ${formatTime(date)}`;
}

/** "12 Sep, 9:31pm" — the photo viewer's timestamp. */
export function formatStamp(date: Date): string {
  return `${formatDay(date)}, ${formatTime(date).replace(/\s/g, "")}`;
}

/** "8–9 Aug 2026", collapsing the month when both ends share one. */
export function formatRange(from: Date, to: Date): string {
  const start = toWall(from);
  const end = toWall(to);

  if (start.month === end.month && start.year === end.year) {
    return `${start.day}–${end.day} ${MONTHS[end.month]} ${end.year}`;
  }
  return `${formatDay(from)} – ${formatDay(to)} ${end.year}`;
}

/* ------------------------------------------------------------------ durations */

/**
 * "7h 32m", with no trailing word — callers add "left" or "Reveals in". Under a minute,
 * including an already-passed span, reads "less than a minute".
 */
export function formatDuration(ms: number): string {
  if (ms < 60_000) return "less than a minute";

  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) return `${days}d ${hours % 24}h`;
  if (hours >= 1) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Ended";
  return `${formatDuration(ms)} left`;
}
