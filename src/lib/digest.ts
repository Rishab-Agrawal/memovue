import "server-only";

import { WEEKDAYS, formatDayYear, toWall, wallDate, wallDateRange } from "./format";
import { tallies } from "./metrics";
import { prisma } from "./prisma";

/**
 * Yesterday, in one message you can read at a traffic light.
 *
 * The shape answers four questions in the order they matter in: did anybody use it, is
 * anything happening today, is it working at all, and is it broken. Anything serving none of
 * those is left out — a digest nobody finishes reading measures nothing, and a number with no
 * denominator beside it is decoration.
 *
 * Almost every figure is a query over rows that already existed rather than a counter. That is
 * what makes this safe to change: a line added here months from now will be correct about last
 * March too. The four tallies are the exceptions, and they are exceptions only because the
 * thing they count leaves nothing behind — see `metrics.ts`.
 */

function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

export async function buildDigest(now: Date = new Date()): Promise<string> {
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
  ]);

  const usedItAll = closedRollGuests.filter(
    (guest) => guest._count.photos >= guest.roll.photosPerGuest,
  ).length;

  const scans = counts.scan ?? 0;
  const heading = `${WEEKDAYS[toWall(yesterday.from).weekday]} ${formatDayYear(yesterday.from)}`;

  return [
    `MemoVue — ${heading}`,
    "",
    "Yesterday",
    `  ${rollsCreated} rolls created · ${newHosts} new hosts`,
    `  ${scans} invitations shown → ${joins} joined (${pct(joins, scans)})`,
    `  ${photos} photos from ${photographers.length} guests`,
    `  ${firstOpens} albums opened for the first time`,
    "",
    "Today",
    `  ${shooting} rolls shooting · ${revealingToday} revealing`,
    "",
    "Overall",
    `  ${hosts} hosts · ${rolls} rolls · ${guests} guests · ${allPhotos} photos`,
    `  ${usedItAll} of ${closedRollGuests.length} guests used their whole film (${pct(usedItAll, closedRollGuests.length)})`,
    `  ${everOpened} of ${revealed} revealed albums have been opened (${pct(everOpened, revealed)})`,
    "",
    "Health",
    `  ${counts.server_error ?? 0} server errors · ${counts.client_error ?? 0} client errors`,
    `  ${counts.upload_dropped ?? 0} uploads given up on`,
    /*
      Read off today's row rather than yesterday's, because both jobs run in the small hours of
      the morning this is sent. A missing tick means the job did not run at all — which is the
      one failure neither a red cron run nor an exception would ever have told anybody about.
    */
    `  backup ${heartbeats.backup_ok ? "✓" : "MISSING"} · sweep ${heartbeats.sweep_ok ? "✓" : "MISSING"}`,
  ].join("\n");
}
