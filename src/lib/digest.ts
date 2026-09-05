import "server-only";

import { costLines, costs } from "./cost";
import { env } from "./env";
import { WEEKDAYS, formatDayYear, toWall, wallDate, wallDateRange } from "./format";
import { tallies } from "./metrics";
import { prisma } from "./prisma";

/**
 * Yesterday, in one message you can read at a traffic light.
 *
 * The shape answers five questions in the order they matter in: did anybody use it, is
 * anything happening today, what is it costing, is it working at all, and is it broken.
 * Anything serving none of those is left out — a digest nobody finishes reading measures
 * nothing, and a number with no denominator beside it is decoration.
 *
 * Cost is the one line that is not a database query. It is here because it is the only
 * number in the message that can go wrong while every other one stays pleasant, and because
 * the alarm for it lives elsewhere on purpose — `scripts/cost.ts` watches the thresholds
 * every four hours, so what belongs in a morning message is the reading, not the alarm.
 *
 * Almost every figure is a query over rows that already existed rather than a counter. That is
 * what makes this safe to change: a line added here months from now will be correct about last
 * March too. The four tallies are the exceptions, and they are exceptions only because the
 * thing they count leaves nothing behind — see `metrics.ts`.
 *
 * The one thing in here that is an alarm rather than a number comes back separately, in
 * `missing`. Everything else in this message is worth reading and none of it is urgent, so the
 * digest has to be safe to skip — and it is not safe to skip if the only warning that a nightly
 * job stopped running is a word near the bottom of it.
 */

function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

/** "1 roll", "2 rolls". Two lines, read three hundred and sixty-five times a year. */
function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

export interface Digest {
  text: string;
  /** Nightly jobs that wrote no heartbeat today. Empty on a healthy morning. */
  missing: string[];
}

export async function buildDigest(now: Date = new Date()): Promise<Digest> {
  const today = wallDate(now);
  const day = wallDate(new Date(now.getTime() - 86_400_000));
  const yesterday = wallDateRange(day);
  const rest = wallDateRange(today);
  const createdYesterday = { createdAt: { gte: yesterday.from, lt: yesterday.to } };

  const [
    rollsCreated,
    newHosts,
    joins,
    photos,
    photographers,
    firstOpens,
    counts,
    heartbeats,
    shooting,
    revealingToday,
    hosts,
    rolls,
    guests,
    allPhotos,
    revealed,
    everOpened,
    closedRollGuests,
    cost,
  ] = await Promise.all([
    prisma.roll.count({ where: createdYesterday }),
    prisma.user.count({ where: createdYesterday }),
    prisma.guest.count({ where: createdYesterday }),
    prisma.photo.count({ where: { status: "READY", ...createdYesterday } }),
    prisma.photo.groupBy({ by: ["guestId"], where: createdYesterday }),
    prisma.roll.count({ where: { albumOpenedAt: { gte: yesterday.from, lt: yesterday.to } } }),
    tallies(day),
    tallies(today),
    prisma.roll.count({
      where: { status: "ACTIVE", startsAt: { lte: now }, finishesAt: { gt: now } },
    }),
    prisma.roll.count({ where: { revealAt: { gte: rest.from, lt: rest.to } } }),
    prisma.user.count(),
    prisma.roll.count(),
    prisma.guest.count(),
    prisma.photo.count({ where: { status: "READY" } }),
    prisma.roll.count({ where: { revealAt: { lt: now } } }),
    prisma.roll.count({ where: { revealAt: { lt: now }, albumOpenedAt: { not: null } } }),
    /*
      Guests on rolls that have finished, with how much of their film they used.

      ponytail: loaded rather than aggregated, because "used every shot" compares a count
      against a limit that lives on another table and differs per roll — one pass in SQL, and
      not expressible in Prisma's `groupBy`. At a few hundred guests it is one page of rows
      once a morning. If it ever reads slowly it is a raw query away from being one pass.
    */
    prisma.guest.findMany({
      where: { roll: { finishesAt: { lt: now } } },
      select: { roll: { select: { photosPerGuest: true } }, _count: { select: { photos: true } } },
    }),
    // Never throws — an unreachable meter comes back as "unreadable" in the line it prints.
    costs(env.cost, now),
  ]);

  const usedItAll = closedRollGuests.filter(
    (guest) => guest._count.photos >= guest.roll.photosPerGuest,
  ).length;

  const scans = counts.scan ?? 0;
  const heading = `${WEEKDAYS[toWall(yesterday.from).weekday]} ${formatDayYear(yesterday.from)}`;

  /*
    Read off today's row rather than yesterday's, because both jobs run in the small hours of
    the morning this is sent. A missing tick means the job did not run at all — the one failure
    neither a red cron run nor an exception could ever have reported, because a job that is no
    longer scheduled does not fail. It simply never happens.
  */
  const missing = [
    heartbeats.backup_ok ? null : "backup",
    heartbeats.sweep_ok ? null : "sweep",
    heartbeats.cost_ok ? null : "cost watch",
  ].filter((name) => name !== null);

  const text = [
    `MemoVue — ${heading}`,
    "",
    "Yesterday",
    `  ${count(rollsCreated, "roll")} created · ${count(newHosts, "new host")}`,
    `  ${count(scans, "invitation")} shown → ${joins} joined (${pct(joins, scans)})`,
    `  ${count(photos, "photo")} from ${count(photographers.length, "guest")}`,
    `  ${count(firstOpens, "album")} opened for the first time`,
    "",
    "Today",
    `  ${count(shooting, "roll")} shooting · ${revealingToday} revealing`,
    "",
    "Overall",
    `  ${count(hosts, "host")} · ${count(rolls, "roll")} · ${count(guests, "guest")} · ${count(allPhotos, "photo")}`,
    `  ${usedItAll} of ${count(closedRollGuests.length, "guest")} used their whole film (${pct(usedItAll, closedRollGuests.length)})`,
    `  ${everOpened} of ${count(revealed, "revealed album")} have been opened (${pct(everOpened, revealed)})`,
    "",
    "Cost",
    ...costLines(cost),
    "",
    "Health",
    `  ${count(counts.server_error ?? 0, "server error")} · ${count(counts.client_error ?? 0, "client error")}`,
    `  ${count(counts.upload_dropped ?? 0, "upload")} given up on`,
    `  backup ${heartbeats.backup_ok ? "✓" : "MISSING"}`
      + ` · sweep ${heartbeats.sweep_ok ? "✓" : "MISSING"}`
      + ` · cost ${heartbeats.cost_ok ? "✓" : "MISSING"}`,
  ].join("\n");

  return { text, missing };
}
