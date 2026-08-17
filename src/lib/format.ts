/**
 * Date, time and duration display.
 *
 * Everything is stored as an instant and shown in **Asia/Kolkata**, a fixed +05:30 with no
 * daylight saving. Two consequences, both deliberate:
 *
 *   - Server and client render identically, so a date on a page cannot cause a hydration
 *     mismatch. That is why the zone is pinned rather than read from the browser.
 *   - The wall-clock accessors below are exact arithmetic rather than Intl round-trips,
 *     because India has no DST. A host who picks 6:00 PM gets a roll that opens at 6:00 PM
 *     their time — the picker and the formatter have to agree on what "6 PM" means, and
 *     mixing `getHours()` with a zone-pinned formatter is precisely how they stop agreeing.
 */
const ZONE = "Asia/Kolkata";
const LOCALE = "en-GB";
const OFFSET_MINUTES = 330;

/**
 * Month names are ours, not the platform's.
 *
 * Current CLDR abbreviates September as "Sept" in every English locale — four characters
 * where the other eleven are three, which breaks the alignment of any column of dates. More
 * to the point, locale data updates with the runtime, and the app's typography should not
 * change because Node shipped a new ICU.
 */
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

export function sameWallDay(a: Date, b: Date): boolean {
  const x = toWall(a);
  const y = toWall(b);
  return x.year === y.year && x.month === y.month && x.day === y.day;
}

/**
 * The two edits a date picker makes: change the day, keep the time — or the reverse.
 *
 * They exist as named operations rather than as arithmetic inside a component because doing
 * this by hand is a trap. `new Date(instant).setUTCHours(h, m)` looks like "keep the day, set
 * the time", and is not: midnight in Kolkata is 18:30 UTC on the *previous* date, so writing a
 * UTC hour onto it silently moves the instant back a day. That is not a rounding error anyone
 * spots in review — it is a calendar that hands back yesterday.
 *
 * Both rebuild the instant from wall-clock fields, so the day and the time that come out are
 * the day and the time a person in India would have read off the screen.
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
 * "7h 32m", with no trailing word.
 *
 * The same span is read three ways — "7h 32m left", "Reveals in 7h 32m", and bare under the
 * word "Left" on a roll header — so the word lives at the call site. Baking "left" into the
 * only formatter produced "Reveals in 7h 32m left".
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

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Ended";
  return `${formatDuration(ms)} left`;
}
