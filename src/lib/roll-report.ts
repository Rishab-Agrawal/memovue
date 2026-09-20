import type { DeletedBy, Prisma } from "@prisma/client";

import { formatDateTime } from "./format";

/**
 * What the query topic says about a roll. Pure, so it is tested without a database — the
 * reading happens in `app/api/telegram/route.ts`, and in `purgeRoll`, which records the last
 * one a roll will ever get.
 */

export const rollReportSelect = {
  name: true,
  createdAt: true,
  startsAt: true,
  finishesAt: true,
  revealMode: true,
  revealDelayHours: true,
  revealedEarly: true,
  maxGuests: true,
  photosPerGuest: true,
  hostId: true,
  /** The wedding business whose code created it, named so a query says who to credit. */
  referrer: { select: { name: true } },
  /** Host included — they are enrolled at creation. Counts are READY photos only. */
  guests: {
    orderBy: { createdAt: "asc" },
    select: {
      name: true,
      userId: true,
      _count: { select: { photos: { where: { status: "READY" } } } },
    },
  },
} satisfies Prisma.RollSelect;

export type RollReport = Prisma.RollGetPayload<{ select: typeof rollReportSelect }>;

/** `named: false` is the version kept after deletion, which must not hold anybody's name. */
export function describeRoll(roll: RollReport, now: Date, named = true): string {
  const reveal =
    roll.revealMode === "DELAY"
      ? `${roll.revealDelayHours}h after the event`
      : roll.revealMode === "DURING"
        ? "during the event"
        : "after the event";

  const lines = [
    roll.name,
    `Created ${formatDateTime(roll.createdAt)}`,
    `Starts ${formatDateTime(roll.startsAt)}`,
    `Ends ${formatDateTime(roll.finishesAt)}`,
    `Reveals ${reveal}${roll.revealedEarly ? " (revealed early)" : ""}`,
    `Up to ${roll.maxGuests} guests · ${roll.photosPerGuest} shots each`,
    // A business survives the roll being anonymised: it is a company, not somebody's guest.
    ...(roll.referrer ? [`Referred by ${roll.referrer.name}`] : []),
    "",
  ];
  if (roll.startsAt > now) return [...lines, "Not started yet."].join("\n");

  const shots = roll.guests.reduce((sum, guest) => sum + guest._count.photos, 0);
  const joined = roll.guests.filter((guest) => guest.userId !== roll.hostId).length;
  let n = 0;
  return [
    ...lines,
    `${shots} shots · ${joined} guests joined`,
    ...roll.guests.map((guest) => {
      const host = guest.userId === roll.hostId;
      const name = named ? `${guest.name}${host ? " (host)" : ""}` : host ? "Host" : `Guest ${++n}`;
      return `  ${name} — ${guest._count.photos}`;
    }),
  ].join("\n");
}

/** A `DeletedRoll`: how it went first, then what it was. */
export function describeDeleted(roll: { summary: string; deletedAt: Date; deletedBy: DeletedBy }): string {
  const how = roll.deletedBy === "HOST" ? "by the host" : "expired, 30 days after it ended";
  return `DELETED ${formatDateTime(roll.deletedAt)}, ${how}\n\n${roll.summary}`;
}

/** `/rolls`: the most recent roll first, and people who never made one last. */
export function describeHosts(hosts: { email: string; rolls: number; latest: Date | null }[]): string {
  return [...hosts]
    .sort((a, b) => (b.latest?.getTime() ?? 0) - (a.latest?.getTime() ?? 0))
    .map((host) => `${host.email} — ${host.rolls} (${host.latest ? formatDateTime(host.latest) : "new"})`)
    .join("\n");
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
