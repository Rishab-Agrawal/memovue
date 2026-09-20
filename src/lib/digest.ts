import "server-only";

import { costLines, costs } from "./cost";
import { env } from "./env";
import { WEEKDAYS, formatDayYear, toWall, wallDate, wallDateRange } from "./format";
import { tallies } from "./metrics";
import { prisma } from "./prisma";
import { referredSince } from "./referrals";
import { openRollWhere } from "./roll-access";

/**
 * Yesterday, in one short message: usage, today, cost, health.
 *
 * Figures are queries over existing rows where possible, so a line added later is right about
 * the past too; tallies cover what leaves no row (see `metrics.ts`). The digest is safe to skip,
 * so the one real alarm — a missing nightly job — comes back separately in `missing`.
 */

function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

/** "1 roll", "2 rolls". */
function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/** Everything the message says about guests, hosts excluded. See the query that fills it. */
interface GuestCounts {
  /** Rows created yesterday: invitations actually accepted. */
  joined: number;
  total: number;
  /** On rolls that have finished shooting — the denominator for the line below. */
  closed: number;
  usedItAll: number;
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
    photos,
    photographers,
    firstOpens,
    counts,
    heartbeats,
    shooting,
    revealingToday,
    hosts,
    rolls,
    allPhotos,
    open,
    everOpened,
    [guests],
    cost,
    referred,
  ] = await Promise.all([
    prisma.roll.count({ where: createdYesterday }),
    prisma.user.count({ where: createdYesterday }),
    prisma.photo.count({ where: { status: "READY", ...createdYesterday } }),
    // The same READY rows as the line above, so the two cannot disagree.
    prisma.photo.groupBy({ by: ["guestId"], where: { status: "READY", ...createdYesterday } }),
    prisma.roll.count({ where: { albumOpenedAt: { gte: yesterday.from, lt: yesterday.to } } }),
    tallies(day),
    tallies(today),
    prisma.roll.count({
      where: { status: "ACTIVE", startsAt: { lte: now }, finishesAt: { gt: now } },
    }),
    prisma.roll.count({ where: { revealAt: { gte: rest.from, lt: rest.to } } }),
    prisma.user.count(),
    prisma.roll.count(),
    prisma.photo.count({ where: { status: "READY" } }),
    prisma.roll.count({ where: openRollWhere(now) }),
    // `albumOpenedAt` is only written while an album is open, so it needs no clock clause.
    prisma.roll.count({ where: { albumOpenedAt: { not: null } } }),
    /*
      Every guest figure, hosts excluded: a host is enrolled in their own roll, which is not
      accepting an invitation. Raw SQL because it compares a guest's `userId` with its roll's
      `hostId`, which the query API cannot express.
    */
    prisma.$queryRaw<[GuestCounts]>`
      select
        count(*) filter (
          where g."createdAt" >= ${yesterday.from} and g."createdAt" < ${yesterday.to}
        )::int as joined,
        count(*)::int as total,
        count(*) filter (where r."finishesAt" < ${now})::int as closed,
        count(*) filter (
          where r."finishesAt" < ${now} and shot.n >= r."photosPerGuest"
        )::int as "usedItAll"
      from "Guest" g
      join "Roll" r on r.id = g."rollId"
      join lateral (select count(*) as n from "Photo" p where p."guestId" = g.id) shot on true
      where g."userId" is null or g."userId" <> r."hostId"
    `,
    // Never throws — an unreachable meter comes back as "unreadable" in the line it prints.
    costs(env.cost, now),
    // Which wedding businesses' codes were typed yesterday. Empty on most mornings.
    referredSince(yesterday.from, yesterday.to),
  ]);

  /*
    The larger of rows and tally. Rows lose deleted rolls; the tally misses days before it
    existed and swallowed write failures. Neither over-counts, so the larger is nearer the truth.
  */
  const rollsMade = Math.max(counts.roll_created ?? 0, rollsCreated);

  const scans = counts.scan ?? 0;
  const heading = `${WEEKDAYS[toWall(yesterday.from).weekday]} ${formatDayYear(yesterday.from)}`;

  // Today's heartbeats, since the jobs run before this is sent. A job that stopped being scheduled never fails; it just never ticks.
  const missing = [
    heartbeats.backup_ok ? null : "backup",
    heartbeats.sweep_ok ? null : "sweep",
    heartbeats.cost_ok ? null : "cost watch",
  ].filter((name) => name !== null);

  const text = [
    `MemoVue — ${heading}`,
    "",
    "Yesterday",
    `  ${count(rollsMade, "roll")} created · ${count(newHosts, "new host")}`,
    `  ${count(scans, "invitation")} shown → ${guests.joined} joined (${pct(guests.joined, scans)})`,
    `  ${count(photos, "photo")} from ${count(photographers.length, "guest")}`,
    `  ${count(firstOpens, "album")} opened for the first time`,
    // Only on a morning after somebody typed a code, so a quiet day's digest stays short.
    ...(referred.length > 0
      ? ["", "Referrals", ...referred.map((by) => `  ${by.name} — ${count(by.rolls, "roll")}`)]
      : []),
    "",
    "Today",
    `  ${count(shooting, "roll")} shooting · ${revealingToday} revealing`,
    "",
    "Overall",
    `  ${count(hosts, "host")} · ${count(rolls, "roll")} · ${count(guests.total, "guest")} · ${count(allPhotos, "photo")}`,
    `  ${guests.usedItAll} of ${count(guests.closed, "guest")} used their whole film (${pct(guests.usedItAll, guests.closed)})`,
    `  ${everOpened} of ${count(open, "open album")} have been opened (${pct(everOpened, open)})`,
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
