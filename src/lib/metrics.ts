import "server-only";

import { wallDate } from "./format";
import { prisma } from "./prisma";

/**
 * The five things worth counting that leave no row behind, plus three heartbeats.
 *
 * Almost nothing belongs here. Hosts, guests and photographs are already rows with a
 * `createdAt`, so the digest counts *those* — a derived number survives a deploy, a restore
 * and a backfill, and can be asked about last March. A counter can do none of that, so it is
 * reserved for what would otherwise be unknowable: an invitation shown to somebody who never
 * joined, an upload the queue gave up on, a crash — and, the one that had to be learned the
 * hard way, a roll, whose row is deleted often enough that counting the rows answers a
 * different question from the one the digest is asking.
 *
 * What is deliberately absent is any identifier at all. This table has three columns and
 * nothing joins to it, so no row here can be turned back into one person's evening. That is
 * not squeamishness — the privacy page makes a promise about tracking, and a tally per day is
 * the strongest instrument that keeps it.
 *
 * The day is a wall-clock date in Kolkata rather than a UTC one, because the person reading
 * the digest is in it: a UTC day cuts an Indian wedding in half at half past five in the
 * morning, so one evening's scans would land under two dates and every ratio would be wrong
 * by however much of the party ran past midnight. `format.ts` already owns that clock.
 */
type MetricName =
  /** An invitation screen rendered for somebody not already in that roll. Funnel top. */
  | "scan"
  /** A reservation the upload queue handed back because it gave up on the photograph. */
  | "upload_dropped"
  /**
   * A roll made.
   *
   * The one name here that is also a row, and the exception to everything said above. `Roll`
   * carries a `createdAt` and the digest counted it straight, until a host who made a roll
   * and deleted it the same evening turned yesterday into a day on which nobody made
   * anything — and the retention pass does the same to every roll thirty days after it
   * finishes, so every past day's figure decays as well. Creating is an event; the row is
   * only what happens to be left of it afterwards.
   */
  | "roll_created"
  /** An exception that reached a browser. */
  | "client_error"
  /** An exception that reached `onRequestError`. */
  | "server_error"
  /** The nightly database copy ran. Absence is the alarm. */
  | "backup_ok"
  /** The nightly retention pass ran. Absence is the alarm. */
  | "sweep_ok"
  /** The four-hourly cost watch ran. Absence is the alarm; `cost.ts` says what it watches. */
  | "cost_ok";

/**
 * Adds one to today's tally, and never fails loudly.
 *
 * Swallowed on purpose: every call site is a page render or a route that has already done the
 * thing being counted, so a database hiccup here must cost a number, not somebody's
 * photograph. Callers inside a request wrap this in `after()` so the count is written once the
 * response is already on its way.
 */
export async function record(name: MetricName, at: Date = new Date()): Promise<void> {
  const day = wallDate(at);
  try {
    await prisma.metric.upsert({
      where: { day_name: { day, name } },
      create: { day, name, count: 1 },
      update: { count: { increment: 1 } },
    });
  } catch (error) {
    console.error("Could not record metric", name, error);
  }
}

/** Every tally for one day, as a plain object. Names that never happened are simply absent. */
export async function tallies(day: string): Promise<Record<string, number>> {
  const rows = await prisma.metric.findMany({ where: { day } });
  return Object.fromEntries(rows.map((row) => [row.name, row.count]));
}
