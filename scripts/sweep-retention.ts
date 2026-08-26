import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

/**
 * The nightly pass. Deployed as a Railway cron service off this same repo, so it runs with
 * the app's own environment and needs no credentials of its own.
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
  const { retentionAction, WARN_BEFORE_DAYS } = await import("../src/lib/roll-access");
  const { prisma } = await import("../src/lib/prisma");

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
    return;
  }

  const report = await runRetention(now);
  console.log(`purged ${report.purged.length}, warned ${report.warned.length}`);

  if (report.failed.length > 0) {
    for (const failure of report.failed) console.error(`FAILED ${failure.id}: ${failure.error}`);
    // A non-zero exit is how Railway surfaces this as a failed cron run rather than a silent
    // one. The rolls it could not finish are simply still there tomorrow.
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
