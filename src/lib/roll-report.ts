import type { RevealMode } from "@prisma/client";

import { formatDateTime } from "./format";

/**
 * What the query topic says about one roll. Pure, so it is tested without a database — the
 * reading happens in `app/api/telegram/route.ts`.
 */

export interface RollReport {
  name: string;
  startsAt: Date;
  finishesAt: Date;
  revealMode: RevealMode;
  revealDelayHours: number;
  revealedEarly: boolean;
  maxGuests: number;
  photosPerGuest: number;
  hostId: string;
  /** Host included — they are enrolled at creation. Counts are READY photos only. */
  guests: { name: string; userId: string | null; _count: { photos: number } }[];
}

export function describeRoll(roll: RollReport, now: Date): string {
  const reveal =
    roll.revealMode === "DELAY"
      ? `${roll.revealDelayHours}h after the event`
      : roll.revealMode === "DURING"
        ? "during the event"
        : "after the event";

  const lines = [
    roll.name,
    `Starts ${formatDateTime(roll.startsAt)}`,
    `Ends ${formatDateTime(roll.finishesAt)}`,
    `Reveals ${reveal}${roll.revealedEarly ? " (revealed early)" : ""}`,
    `Up to ${roll.maxGuests} guests · ${roll.photosPerGuest} shots each`,
    "",
  ];
  if (roll.startsAt > now) return [...lines, "Not started yet."].join("\n");

  const shots = roll.guests.reduce((sum, guest) => sum + guest._count.photos, 0);
  const joined = roll.guests.filter((guest) => guest.userId !== roll.hostId).length;
  return [
    ...lines,
    `${shots} shots · ${joined} guests joined`,
    ...roll.guests.map(
      (guest) => `  ${guest.name}${guest.userId === roll.hostId ? " (host)" : ""} — ${guest._count.photos}`,
    ),
  ].join("\n");
}

/** Telegram refuses a message over 4096 characters, and a 500-guest roll runs past that. */
export function chunk(text: string, limit = 4096): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    if (current && current.length + 1 + line.length > limit) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  return [...chunks, current];
}
