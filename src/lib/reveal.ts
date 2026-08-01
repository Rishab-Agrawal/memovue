/**
 * The event timeline has exactly one moving part: `revealAt`.
 *
 * Guests can shoot from `startsAt` until `revealAt`, and everything unlocks at `revealAt`.
 * Folding "when does shooting stop" into "when do photos appear" keeps event creation to a
 * single time question instead of three, and matches how people actually think about a
 * disposable camera — you shoot all night, you see the pictures in the morning.
 */

export type EventPhase = "scheduled" | "capturing" | "revealed";

export interface RevealTimings {
  startsAt: Date | string;
  revealAt: Date | string;
}

export function eventPhase(event: RevealTimings, now: Date = new Date()): EventPhase {
  const startsAt = new Date(event.startsAt);
  const revealAt = new Date(event.revealAt);
  if (now < startsAt) return "scheduled";
  if (now < revealAt) return "capturing";
  return "revealed";
}

export function isRevealed(event: RevealTimings, now: Date = new Date()): boolean {
  return eventPhase(event, now) === "revealed";
}

export function computeRevealAt(startsAt: Date, delayHours: number): Date {
  return new Date(startsAt.getTime() + delayHours * 60 * 60 * 1000);
}

/** "2 days 4 hours", "5 minutes", "any moment now" — for countdowns. */
export function formatCountdown(target: Date | string, now: Date = new Date()): string {
  const ms = new Date(target).getTime() - now.getTime();
  if (ms <= 0) return "any moment now";

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  if (days > 0) return hours > 0 ? `${unit(days, "day")} ${unit(hours, "hour")}` : unit(days, "day");
  if (hours > 0) {
    return minutes > 0 ? `${unit(hours, "hour")} ${unit(minutes, "min")}` : unit(hours, "hour");
  }
  if (minutes > 0) return unit(minutes, "min");
  return "less than a minute";
}

export function formatDateTime(value: Date | string): string {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
