import "server-only";

import { createGzip } from "node:zlib";
import { PassThrough, type Readable } from "node:stream";
import { Client, types } from "pg";

import { backupKey, deleteObjects, putStream, storageConfigured } from "./storage";

/**
 * A nightly copy of the database into R2, since Railway only schedules backups on Pro.
 *
 * Rows, not `pg_dump`: the database is Postgres 18 and the image's client is older, which
 * `pg_dump` refuses. The schema is in `prisma/migrations`; a restore replays those, then this.
 * NDJSON, gzipped, streamed the whole way.
 */

/**
 * Dependency order, so a restore never inserts a row before the row it points at.
 * **A new table has to be added here** — `runBackup` fails if one is missing.
 */
export const TABLES = [
  "User",
  "Referrer",
  "Redemption",
  "CodeRequest",
  "Roll",
  "Guest",
  "Photo",
  "DeletedRoll",
  "Metric",
] as const;

/*
  Dates are transcribed, never interpreted. node-postgres reads a zone-less `timestamp` in the
  process's local time, so round-tripping it through a Date shifts every date by the machine's
  offset. The raw string goes out and comes back unchanged. 1114 `timestamp`, 1082 `date`,
  1184 `timestamptz`.

  ponytail: text-shaped types only. A `bytea` column would need base64; there are none.
*/
for (const oid of [1114, 1082, 1184]) {
  types.setTypeParser(oid, (value) => value);
}

/** A connection that transcribes rather than interprets. Both halves of a backup use it. */
export async function connect(): Promise<Client> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Missing required environment variable: DATABASE_URL");

  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

/** How many nights are kept. A week is long enough to notice damage before it ages out. */
const KEEP_DAYS = 7;

/** Rows per round trip, paged by primary key rather than OFFSET. */
const PAGE = 2_000;

interface BackupReport {
  key: string;
  rows: Record<string, number>;
  total: number;
}

/** `2026-09-05`, which is both the file name and the thing rotation counts back from. */
function backupDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

async function* readTable(client: Client, table: string): AsyncGenerator<string> {
  let after = "";

  for (;;) {
    // The identifier is from TABLES above, never from input; the value is parameterised.
    const page = await client.query(
      `select * from "${table}" where id > $1 order by id limit ${PAGE}`,
      [after],
    );
    if (page.rows.length === 0) return;

    for (const row of page.rows) yield `${JSON.stringify({ table, row })}\n`;

    after = page.rows[page.rows.length - 1].id;
    if (page.rows.length < PAGE) return;
  }
}

/** Everything as one gzipped stream, never holding a table in memory. */
function serialise(client: Client, rows: Record<string, number>): Readable {
  const out = new PassThrough();
  const gzip = createGzip();
  gzip.pipe(out);

  void (async () => {
    try {
      for (const table of TABLES) {
        rows[table] = 0;
        for await (const line of readTable(client, table)) {
          rows[table] += 1;
          // Respect back-pressure, or the buffer becomes the memory streaming was meant to avoid.
          if (!gzip.write(line)) {
            await new Promise((resolve) => gzip.once("drain", resolve));
          }
        }
      }
      gzip.end();
    } catch (error) {
      // Destroyed rather than ended: a truncated file that uploads cleanly looks like a backup.
      gzip.destroy(error instanceof Error ? error : new Error(String(error)));
      out.destroy(error instanceof Error ? error : new Error(String(error)));
    }
  })();

  return out;
}

/** One night's pass. Safe to run twice: the key is the date, so a rerun overwrites. */
export async function runBackup(now: Date = new Date()): Promise<BackupReport> {
  if (!storageConfigured) throw new Error("R2 is not configured, so there is nowhere to put it.");

  const client = await connect();
  const rows: Record<string, number> = {};
  const key = backupKey(backupDay(now));

  try {
    await putStream(key, serialise(client, rows), "application/gzip");

    // A table missing from `TABLES` is a failed backup, not a smaller one.
    const live = await client.query<{ relname: string }>(
      `select relname from pg_stat_user_tables where relname not like '\_%'`,
    );
    const missed = live.rows
      .map((row) => row.relname)
      .filter((name) => !TABLES.includes(name as (typeof TABLES)[number]));

    if (missed.length > 0) {
      throw new Error(`Not in TABLES, so not backed up: ${missed.join(", ")}. Add them.`);
    }
  } finally {
    await client.end();
  }

  await rotate(now);

  return { key, rows, total: Object.values(rows).reduce((sum, n) => sum + n, 0) };
}

/**
 * Drops aged-out nights by name rather than by listing the bucket. A fortnight-wide window so a
 * missed run heals itself; deleting a key that was never written is free.
 */
async function rotate(now: Date): Promise<void> {
  const stale: string[] = [];
  for (let age = KEEP_DAYS; age < KEEP_DAYS + 14; age += 1) {
    stale.push(backupKey(backupDay(new Date(now.getTime() - age * 86_400_000))));
  }
  await deleteObjects(stale);
}
