import "./load-env";

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
  // Imported here rather than at the top: `env.ts` reads process.env the moment it loads
  // and throws on anything missing, so nothing may be imported before `load-env`.
  const { runBackup } = await import("../src/lib/backup");
  const { record } = await import("../src/lib/metrics");

  const report = await runBackup();
  const tables = Object.entries(report.rows)
    .map(([table, count]) => `${table} ${count}`)
    .join(", ");

  console.log(`${report.key} — ${report.total} rows (${tables})`);

  /*
    A heartbeat, so the digest can notice this having quietly stopped.

    A backup that fails is loud. A backup that is no longer scheduled is silent, and silence is
    how a month goes by with nothing being copied anywhere — which is only discovered on the
    one day it matters. The digest reads the absence of this row, so there is nothing to
    remember and nothing to check by hand.
  */
  await record("backup_ok");
}

main().catch(async (error) => {
  console.error(error);
  // Imported here rather than at the top, like everything else in this file: `env.ts` reads
  // its configuration at module scope, so nothing may be imported before `load-env` has run.
  const { alert } = await import("../src/lib/telegram");
  await alert(
    "backup",
    `Backup failed\n\n${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
