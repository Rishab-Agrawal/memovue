import "./load-env";

/**
 * Puts a night back.
 *
 * The half of a backup that is usually never written, and therefore the half that turns out
 * not to work on the night it is needed. It reads the same NDJSON the backup wrote, in the
 * order it was written — `TABLES` is in dependency order, so a guest never arrives before its
 * roll — and inserts row by row.
 *
 *   npm run restore -- 2026-09-05          # a date, or a full key
 *   npm run restore -- 2026-09-05 --yes    # actually write
 *
 * Without `--yes` it reads the file, counts what it holds, and writes nothing. That is the
 * default because this is the one script in the repo that can destroy a live database by
 * being run at the wrong moment, and a dry run costs a few seconds.
 *
 * The schema is not in the file. Run `npx prisma migrate deploy` first: the migrations are in
 * git and are the authority on shape, which is exactly why the backup does not duplicate them.
 */
async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const target = args.find((arg) => !arg.startsWith("--"));
  const write = args.includes("--yes");

  if (!target) {
    console.error("Which backup? e.g. npm run restore -- 2026-09-05");
    process.exit(1);
  }

  const { restoreBackup } = await import("../src/lib/backup-restore");

  const report = await restoreBackup(target, { write });
  const tables = Object.entries(report.rows)
    .map(([table, count]) => `${table} ${count}`)
    .join(", ");

  console.log(`${report.key} — ${report.total} rows (${tables})`);
  console.log(
    write
      ? `Restored. ${report.skipped} row(s) were already there and were left alone.`
      : "Nothing was written. Add --yes to restore.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
