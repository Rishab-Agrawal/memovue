import "server-only";

import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { TABLES, connect } from "./backup";
import { backupKey, getObjectStream, storageConfigured } from "./storage";

/**
 * Reading a night back in.
 *
 * Separate from `backup.ts` so the nightly job does not carry it: the cron service imports
 * only what it runs, and this is the half that runs once, by hand, on the worst day.
 *
 * `INSERT ... ON CONFLICT DO NOTHING`, one row at a time, in the order the file was written.
 * Not `UPDATE`: a restore is for rows that are gone, and a row still present in the live
 * database is newer than the copy in the file. Skipping it is the only answer that cannot
 * lose something.
 */

interface RestoreReport {
  key: string;
  rows: Record<string, number>;
  total: number;
  /** Rows already present, left as they were. */
  skipped: number;
}

/** Either a date the backup named a file after, or a full key pasted out of the bucket. */
function keyFor(target: string): string {
  return target.includes("/") ? target : backupKey(target);
}

export async function restoreBackup(
  target: string,
  { write }: { write: boolean },
): Promise<RestoreReport> {
  if (!storageConfigured) throw new Error("R2 is not configured, so there is nothing to read.");

  const key = keyFor(target);
  const body = await getObjectStream(key);
  if (!body) throw new Error(`No backup at ${key}.`);

  // The same connection the backup used, so the dates it transcribed go back unchanged.
  const client = await connect();

  const rows: Record<string, number> = {};
  let skipped = 0;

  try {
    const lines = createInterface({
      input: (body as NodeJS.ReadableStream).pipe(createGunzip()),
      crlfDelay: Infinity,
    });

    for await (const line of lines) {
      if (!line.trim()) continue;

      const { table, row } = JSON.parse(line) as { table: string; row: Record<string, unknown> };
      // The file names its own tables, and a file is something a caller supplies — so the
      // name is checked against the list rather than interpolated on trust.
      if (!TABLES.includes(table as (typeof TABLES)[number])) {
        throw new Error(`Backup names a table that is not in TABLES: ${table}`);
      }

      rows[table] = (rows[table] ?? 0) + 1;
      if (!write) continue;

      const columns = Object.keys(row);
      const result = await client.query(
        `insert into "${table}" (${columns.map((c) => `"${c}"`).join(", ")})
         values (${columns.map((_, i) => `$${i + 1}`).join(", ")})
         on conflict do nothing`,
        columns.map((column) => row[column]),
      );
      if (result.rowCount === 0) skipped += 1;
    }
  } finally {
    await client.end();
  }

  return { key, rows, total: Object.values(rows).reduce((sum, n) => sum + n, 0), skipped };
}
