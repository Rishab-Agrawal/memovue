import "./load-env";

/**
 * The nightly database copy, deployed as a Railway cron off this repo. The work is in
 * `src/lib/backup.ts`. Safe to run twice: the key is the date.
 *
 *   npm run backup
 *   npm run restore -- <key>
 */
async function main() {
  // Imported after `load-env`, because `env.ts` reads process.env the moment it loads.
  const { runBackup } = await import("../src/lib/backup");
  const { record } = await import("../src/lib/metrics");

  const report = await runBackup();
  const tables = Object.entries(report.rows)
    .map(([table, count]) => `${table} ${count}`)
    .join(", ");

  console.log(`${report.key} — ${report.total} rows (${tables})`);

  // A heartbeat: a backup that stopped being scheduled is silent, so the digest reads its absence.
  await record("backup_ok");
}

main().catch(async (error) => {
  console.error(error);
  const { alert } = await import("../src/lib/telegram");
  const { messageOf } = await import("../src/lib/alert-text");
  await alert("backup", {
    what: "Last night's database backup failed.",
    meaning:
      "Nothing is lost and the site is unaffected — but there is no fresh copy of the database,"
      + " so if it were lost before the next good backup, the newest copy would be older than"
      + " it should be.",
    action: "Nothing yet; it runs again tonight. If this arrives two nights running, send it to Claude.",
    detail: messageOf(error),
  });
  process.exit(1);
});
