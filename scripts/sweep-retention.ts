import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

/**
 * The nightly pass. Deployed as a Railway cron service off this same repo, so it runs with
 * the app's own environment and needs no credentials of its own.
 *
 * Deletion, and nothing a guest would ever notice: rolls past their date, and reservations
 * nobody is coming back for. It stays on this side of the product deliberately — a scheduled
 * job is the wrong instrument for telling someone their album has opened, because a message
 * about a moment on a clock is worth very little a night later.
 *
 * Deliberately thin: the rules live in `src/lib/retention.ts` where they can be unit-tested,
 * and this only decides what an operator sees and what the exit code says. Safe to run twice
 * in one night and safe to miss a night — nothing here depends on having run yesterday.
 *
 * Run it by hand with `npm run sweep`. Add `--dry` to be told what it would do and touch
 * nothing, which is the sensible way to meet it for the first time against a real database.
 */
async function main() {
  // Imported after dotenv, because `env.ts` reads process.env at module scope and throws on
  // anything missing.
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

  /*
    A heartbeat, so that the digest can notice this job having quietly stopped.

    A cron service that fails is loud — Railway marks the run red and the catch below sends a
    message. A cron service that is *not scheduled any more*, or whose container never starts,
    is completely silent, and that is the failure that goes unnoticed for a month. So absence
    is what the digest reads, and the only way to write this row is to have got to here.
  */
  await record("sweep_ok");

  if (report.failed.length > 0) {
    for (const failure of report.failed) console.error(`FAILED ${failure.id}: ${failure.error}`);
    await alert(
      "sweep-partial",
      `Sweep could not finish ${report.failed.length} roll(s)\n\n` +
        report.failed.map((failure) => `${failure.id}: ${failure.error}`).join("\n"),
    );
    // A non-zero exit is how Railway surfaces this as a failed cron run rather than a silent
    // one. The rolls it could not finish are simply still there tomorrow.
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error);
  // Imported here too, because this runs outside `main` and therefore outside its imports —
  // and because the thing most likely to have thrown is one of them.
  const { alert } = await import("../src/lib/telegram");
  await alert("sweep", `Sweep failed\n\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
