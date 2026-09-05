import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

/**
 * The nightly database copy. Deployed as a Railway cron service off this same repo, so it
 * runs with the app's own environment and needs no credentials of its own.
 *
 * Deliberately thin, like `sweep-retention.ts`: the work is in `src/lib/backup.ts` where it
 * can be read and tested, and this only decides what an operator sees and what the exit code
 * says. Safe to run twice in one night — the key is the date, so the second run overwrites
 * the first with the same day.
 *
 * Run it by hand with `npm run backup`. Restore with `npm run restore -- <key>`.
 */
async function main() {
  // After dotenv, because `env.ts` reads process.env at module scope and throws on anything
  // missing.
  const { runBackup } = await import("../src/lib/backup");

  const report = await runBackup();
  const tables = Object.entries(report.rows)
    .map(([table, count]) => `${table} ${count}`)
    .join(", ");

  console.log(`${report.key} — ${report.total} rows (${tables})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
