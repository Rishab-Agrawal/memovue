import "./load-env";

/**
 * The morning digest. Deployed as a third Railway cron service off this same repo, scheduled
 * after the backup and the sweep so it can report on whether they ran.
 *
 * Deliberately thin, like the other two: the numbers are assembled in `src/lib/digest.ts` and
 * this only decides where they go. It sends even on a day when nothing happened, on purpose —
 * a digest that only arrives when there is news is indistinguishable from one that has
 * silently stopped arriving, and that is the whole failure mode this is built to avoid.
 *
 * One line of it is not a number, and that line goes to the alerts topic instead. A nightly job
 * that has stopped being scheduled raises no exception and fails no deployment, so the absence
 * of its heartbeat is the only evidence there will ever be — and evidence that only appears
 * near the bottom of a message full of pleasant statistics is evidence nobody reads. The digest
 * itself is then genuinely optional, which is the point of moving this out of it.
 *
 * Run it by hand with `npm run digest`, which prints the same message it sends.
 */
async function main() {
  // Imported here rather than at the top: `env.ts` reads process.env the moment it loads
  // and throws on anything missing, so nothing may be imported before `load-env`.
  const { buildDigest } = await import("../src/lib/digest");
  const { alert, notify } = await import("../src/lib/telegram");

  const { text, missing } = await buildDigest();
  console.log(text);
  if (missing.length > 0) console.error(`MISSING: ${missing.join(", ")}`);

  if (process.argv.includes("--dry")) return;

  await notify("daily", text);

  if (missing.length > 0) {
    const named: Record<string, string> = {
      backup: "the database backup",
      sweep: "the nightly cleanup",
      "cost watch": "the cost watch",
    };
    await alert("heartbeat", {
      what: `Last night, ${missing.map((name) => named[name] ?? name).join(" and ")} did not run.`,
      meaning: [
        missing.includes("backup")
          ? "No copy of the database was made. If it were lost today, the newest copy would be"
            + " from the last night this worked."
          : null,
        missing.includes("sweep")
          ? "Photos past their deletion date are still stored, and uploads that never finished"
            + " are still holding guests' shots."
          : null,
        missing.includes("cost watch")
          ? "Nothing is checking the bill. Railway's own spending limit still applies, so the"
            + " spend is still capped — but nothing will warn you before that limit takes the"
            + " site offline."
          : null,
      ]
        .filter((line) => line !== null)
        .join(" "),
      action:
        "Open Railway and check that the job is still scheduled and its last run did not fail —"
        + " a job that stops being scheduled reports nothing on its own. If it is scheduled and"
        + " still not running, send this to Claude.",
    });
  }
}

main().catch(async (error) => {
  console.error(error);
  const { alert } = await import("../src/lib/telegram");
  const { messageOf } = await import("../src/lib/alert-text");
  await alert("digest", {
    what: "This morning's daily summary could not be put together.",
    meaning: "Only the summary is missing. The site is unaffected.",
    action: "Nothing yet; it runs again tomorrow morning. If it fails again, send this to Claude.",
    detail: messageOf(error),
  });
  process.exit(1);
});
