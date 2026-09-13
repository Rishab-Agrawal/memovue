import "./load-env";

/**
 * The nightly retention pass, deployed as a Railway cron off this repo. The rules live in
 * `src/lib/retention.ts`; this only reports and sets the exit code. Safe to run twice or miss
 * a night.
 *
 *   npm run sweep           # purge, warn, release
 *   npm run sweep -- --dry  # say what it would do, change nothing
 */
async function main() {
  // Imported after `load-env`, because `env.ts` reads process.env the moment it loads.
  const { runRetention } = await import("../src/lib/retention");
  const { ABANDONED_UPLOAD_DAYS, retentionAction, WARN_BEFORE_DAYS } =
    await import("../src/lib/roll-access");
  const { prisma } = await import("../src/lib/prisma");
  const { record } = await import("../src/lib/metrics");
  const { alert } = await import("../src/lib/telegram");

  const dry = process.argv.includes("--dry");
  const now = new Date();

  if (dry) {
    const rolls = await prisma.roll.findMany({
      where: { keptUntil: { lte: new Date(now.getTime() + WARN_BEFORE_DAYS * 86_400_000) } },
      select: { id: true, name: true, keptUntil: true, warnedAt: true, _count: { select: { photos: true } } },
      orderBy: { keptUntil: "asc" },
    });

    for (const roll of rolls) {
      const action = retentionAction(roll, now);
      if (action === "leave") continue;
      console.log(
        `${action.toUpperCase().padEnd(5)} ${roll.name} — ${roll._count.photos} photos, ` +
          `kept until ${roll.keptUntil.toISOString().slice(0, 10)}`,
      );
    }
    console.log(`\n${rolls.length} roll(s) within the horizon. Nothing was changed.`);

    const abandoned = await prisma.photo.count({
      where: {
        status: "PENDING",
        createdAt: { lt: new Date(now.getTime() - ABANDONED_UPLOAD_DAYS * 86_400_000) },
      },
    });
    console.log(`${abandoned} abandoned reservation(s) would be released.`);
    return;
  }

  const report = await runRetention(now);
  console.log(
    `purged ${report.purged.length}, warned ${report.warned.length}, ` +
      `released ${report.released}`,
  );

  // A heartbeat: a cron that stopped being scheduled is silent, so the digest reads its absence.
  await record("sweep_ok");

  if (report.failed.length > 0) {
    for (const failure of report.failed) console.error(`FAILED ${failure.id}: ${failure.error}`);
    await alert("sweep-partial", {
      what: `The nightly cleanup could not finish ${report.failed.length} roll(s).`,
      meaning:
        "Those rolls are past their deletion date and are still stored. Everything else was"
        + " cleaned up, and they will be tried again tonight.",
      action: "Nothing yet. If the same rolls fail again tomorrow, send this to Claude.",
      detail: report.failed.map((failure) => `${failure.id}: ${failure.error}`).join("\n"),
    });
    // Non-zero so Railway marks the run as failed.
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error);
  // Imported here too: whatever threw may have been one of `main`'s imports.
  const { alert } = await import("../src/lib/telegram");
  const { messageOf } = await import("../src/lib/alert-text");
  await alert("sweep", {
    what: "The nightly cleanup job failed.",
    meaning:
      "Rolls past their deletion date were not deleted, and shots held by uploads that never"
      + " finished were not given back to guests. The site itself is unaffected.",
    action: "Nothing yet; it runs again tonight. If this arrives two nights running, send it to Claude.",
    detail: messageOf(error),
  });
  process.exit(1);
});
