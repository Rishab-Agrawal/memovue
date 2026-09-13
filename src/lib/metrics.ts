import "server-only";

import { wallDate } from "./format";
import { prisma } from "./prisma";

/**
 * Daily tallies of what leaves no row behind, plus heartbeats. Everything with a row is counted
 * from the rows instead. No identifiers of any kind, so nothing here traces back to a person.
 * Days are Kolkata wall-clock dates, so one evening does not split across two.
 */
type MetricName =
  /** An invitation screen rendered for somebody not already in that roll. Funnel top. */
  | "scan"
  /** A reservation the upload queue handed back because it gave up on the photograph. */
  | "upload_dropped"
  /** A roll made. Counted too because roll rows are deleted, which would shrink past days. */
  | "roll_created"
  /** An exception that reached a browser. */
  | "client_error"
  /** An exception that reached `onRequestError`. */
  | "server_error"
  /** The nightly database copy ran. Absence is the alarm. */
  | "backup_ok"
  /** The nightly retention pass ran. Absence is the alarm. */
  | "sweep_ok"
  /** The four-hourly cost watch ran. Absence is the alarm. */
  | "cost_ok";

/**
 * Adds one to today's tally and never throws: a database hiccup must cost a number, not the
 * action being counted. Request callers wrap this in `after()`.
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
