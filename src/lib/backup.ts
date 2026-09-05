import "server-only";

import { createGzip } from "node:zlib";
import { PassThrough, type Readable } from "node:stream";
import { Client, types } from "pg";

import { backupKey, deleteObjects, putStream, storageConfigured } from "./storage";

/**
 * A nightly copy of the database, into the same bucket the photographs live in.
 *
 * The bytes of a photograph are in R2; everything that says *what* a photograph is — whose
 * roll, whose camera, when it was taken, when it opens — is in Postgres. Lose that and the
 * bucket is a pile of objects nothing can name, which is not a recoverable position. Railway
 * takes scheduled backups for you on its Pro plan and not below it, so this is that job.
 *
 * **Rows, not `pg_dump`.** The database is Postgres 18 and the newest client Railpack's apt
 * will install is older than that, which `pg_dump` refuses outright — so the choice was
 * fighting a base image on a schedule, or reading the rows out through the driver the app
 * already talks to. The schema is not in here because the schema is already in git, in
 * `prisma/migrations`; a restore replays those first and then this.
 *
 * NDJSON, gzipped, one row per line, streamed the whole way — nothing here holds a table in
 * memory, so the shape of the job does not change when the rolls get big.
 */

/**
 * Dependency order, and the reason this list is written out rather than discovered.
 *
 * A restore replays the file top to bottom, so a row must not arrive before the row it points
 * at: guests need their roll, photographs need both. Reading the order out of the catalogue
 * would be a graph sort to save six lines and would break silently the first time somebody
 * added a cycle-shaped relation.
 *
 * **A new table has to be added here.** Nothing else in the app will notice it is missing —
 * see the count check in `runBackup`, which is what turns that into an error rather than a
 * backup that is quietly incomplete.
 */
export const TABLES = ["User", "BetaAccess", "BetaRequest", "Roll", "Guest", "Photo"] as const;

/*
  Dates are transcribed, never interpreted.

  node-postgres turns a `timestamp` — which Prisma uses for every DateTime here, and which
  carries no zone — into a JS Date by reading it in the *process's* local time. Write that
  back out as an ISO string and the value moves by whatever the machine's offset happens to
  be. A backup taken on a laptop in India and restored anywhere else shifted every date in
  the database by five and a half hours: every reveal time, every closing time, every
  deletion date, silently and plausibly.

  Handing back the raw string instead removes the question. Postgres printed it, Postgres
  parses it back, and nothing in between has an opinion about zones. 1114 is `timestamp`,
  1082 `date`, 1184 `timestamptz` — the last two are unused today and are set anyway, since
  the failure they prevent is invisible until a restore.

  ponytail: text-shaped types only. A `bytea` column would still need base64 on the way out;
  there are none, and `runBackup` throws on a table it has not been told about, which is the
  moment somebody would be adding one.
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
export const KEEP_DAYS = 7;

/**
 * Rows per round trip.
 *
 * Keyset pagination on the primary key rather than `OFFSET`, which re-walks everything it
 * skips and turns a big table into a quadratic read. Every model here has a text `id`, so one
 * comparison serves all of them.
 */
const PAGE = 2_000;

export interface BackupReport {
  key: string;
  rows: Record<string, number>;
  total: number;
}

/** `2026-09-05`, which is both the file name and the thing rotation counts back from. */
export function backupDay(now: Date): string {
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

/**
 * Everything, as one gzipped stream.
 *
 * Written into a `PassThrough` rather than assembled and handed over, so a table is never
 * held whole — the upload consumes lines as fast as the database produces them, and the
 * counts come back at the end for the caller to check.
 */
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
          // Respect back-pressure: without this a fast table outruns the upload and the
          // buffer becomes the memory the streaming was meant to avoid.
          if (!gzip.write(line)) {
            await new Promise((resolve) => gzip.once("drain", resolve));
          }
        }
      }
      gzip.end();
    } catch (error) {
      // Destroying rather than ending: a truncated file that uploads cleanly is worse than
      // no file, because it looks like a backup until the night you need it.
      gzip.destroy(error instanceof Error ? error : new Error(String(error)));
      out.destroy(error instanceof Error ? error : new Error(String(error)));
    }
  })();

  return out;
}

/**
 * One night's pass. Safe to run twice — the key is the date, so a second run overwrites the
 * first with the same day's data rather than accumulating.
 */
export async function runBackup(now: Date = new Date()): Promise<BackupReport> {
  if (!storageConfigured) throw new Error("R2 is not configured, so there is nowhere to put it.");

  const client = await connect();
  const rows: Record<string, number> = {};
  const key = backupKey(backupDay(now));

  try {
    await putStream(key, serialise(client, rows), "application/gzip");

    /*
      A table this file has never heard of is a failed backup, not a smaller one.

      Adding a model to the schema and forgetting to add it to `TABLES` would otherwise
      produce a backup that uploads, reports success every night, and is missing a table —
      discovered at the only moment it matters. The catalogue is asked what actually exists.
    */
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
 * Drops the nights that have aged out.
 *
 * By name rather than by listing the bucket: the keys are dates, so the ones to delete can be
 * worked out from the calendar. A window rather than a single day so a missed run heals
 * itself — a fortnight of names costs one request, since `deleteObjects` batches.
 *
 * Deleting a key that was never written is free, which is what makes this safe to be wrong
 * about.
 */
async function rotate(now: Date): Promise<void> {
  const stale: string[] = [];
  for (let age = KEEP_DAYS; age < KEEP_DAYS + 14; age += 1) {
    stale.push(backupKey(backupDay(new Date(now.getTime() - age * 86_400_000))));
  }
  await deleteObjects(stale);
}
