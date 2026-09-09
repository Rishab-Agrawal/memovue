import "server-only";

import { costLines, costs } from "./cost";
import { env } from "./env";
import { WEEKDAYS, formatDayYear, toWall, wallDate, wallDateRange } from "./format";
import { tallies } from "./metrics";
import { prisma } from "./prisma";
import { openRollWhere } from "./roll-access";

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
  ] = await Promise.all([
    prisma.roll.count({ where: createdYesterday }),
    prisma.user.count({ where: createdYesterday }),
    prisma.photo.count({ where: { status: "READY", ...createdYesterday } }),
    // The same rows the line above counts. Without the status these disagree, and the digest
    // says a number of photographs arrived from more people than took them.
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
    // No clause about the clock beside it: `albumOpenedAt` is only ever written while the
    // album is open, so the column already carries the condition the denominator applies.
    prisma.roll.count({ where: { albumOpenedAt: { not: null } } }),
    /*
      Every guest figure in the message, with the hosts taken out of them.

      A host is enrolled in their own roll the moment it is created, so a `Guest` row stopped
      being the same thing as somebody having accepted an invitation. Counted straight, each
      roll created added a phantom join to a funnel whose top its host never passed through —
      a day with no invitations shown and three rolls made read "0 shown → 3 joined" — and put
      the host's own untouched quota into "used their whole film".

      Raw because the rule compares two tables, a guest's `userId` against their roll's
      `hostId`, which the query API cannot express. One statement rather than three round
      trips, and it replaces the page of guest rows this used to load to do the arithmetic in
      JavaScript.
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
  ]);

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
    `  ${count(scans, "invitation")} shown → ${guests.joined} joined (${pct(guests.joined, scans)})`,
    `  ${count(photos, "photo")} from ${count(photographers.length, "guest")}`,
    `  ${count(firstOpens, "album")} opened for the first time`,
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
