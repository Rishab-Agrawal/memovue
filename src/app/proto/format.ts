/**
 * Date and time display.
 *
 * Every formatter pins its locale AND its time zone. Without the time zone a date rendered
 * on the server and re-rendered on the client disagree the moment the two are in different
 * zones, and React reports a hydration mismatch on a screen whose only crime was showing a
 * countdown. The mock data is written in +05:30, so that is the zone the prototype reads in.
 */
const ZONE = "Asia/Kolkata";
const LOCALE = "en-US";

function parts(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: ZONE, ...options }).format(date);
}

/** "Sep 12" */
export function formatDay(date: Date): string {
  return parts(date, { month: "short", day: "numeric" });
}

/** "Sep 12, 2026" */
export function formatDayYear(date: Date): string {
  return parts(date, { month: "short", day: "numeric", year: "numeric" });
}

/** "6:00 PM" */
export function formatTime(date: Date): string {
  return parts(date, { hour: "numeric", minute: "2-digit", hour12: true });
}

/** "Sep 12, 2026 at 6:00 PM" — the value shown on a settings row. */
export function formatDateTime(date: Date): string {
  return `${formatDayYear(date)} at ${formatTime(date)}`;
}

/** "Sep 12 at 6:00 PM" — the reveal chip, which has less room. */
export function formatShortDateTime(date: Date): string {
  return `${formatDay(date)} at ${formatTime(date)}`;
}

/** "Sep 12, 9:31pm" — the photo viewer's timestamp, lowercase like the reference. */
export function formatStamp(date: Date): string {
  return `${formatDay(date)}, ${formatTime(date).toLowerCase().replace(" ", "")}`;
}

/** "Aug 8–9, 2026", collapsing the month when both ends share one. */
export function formatRange(from: Date, to: Date): string {
  const sameMonth = parts(from, { month: "short" }) === parts(to, { month: "short" });
  const year = parts(to, { year: "numeric" });

  if (sameMonth) {
    return `${formatDay(from)}–${parts(to, { day: "numeric" })}, ${year}`;
  }
  return `${formatDay(from)} – ${formatDay(to)}, ${year}`;
}
