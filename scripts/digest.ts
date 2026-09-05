import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

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
  // After dotenv, because `env.ts` reads process.env at module scope and throws on anything
  // missing.
  const { buildDigest } = await import("../src/lib/digest");
  const { alert, notify } = await import("../src/lib/telegram");

  const { text, missing } = await buildDigest();
  console.log(text);
  if (missing.length > 0) console.error(`MISSING: ${missing.join(", ")}`);

  if (process.argv.includes("--dry")) return;

  await notify("daily", text);

  if (missing.length > 0) {
    await alert(
      "heartbeat",
      [
        `${missing.join(" and ")} did not run last night`,
        "",
        missing.includes("backup")
          ? "Nothing has been copied out of Postgres. If the database is lost today, the"
            + " most recent copy is from whenever it last succeeded."
          : null,
        missing.includes("sweep")
          ? "Nothing was purged or released. Photographs past their deletion date are still"
            + " stored, and abandoned reservations are still spending guests' shots."
          : null,
        "",
        "Check the Railway cron service is still scheduled — a job that is no longer scheduled",
        "fails nothing and reports nothing.",
      ]
        .filter((line) => line !== null)
        .join("\n"),
    );
  }
}

main().catch(async (error) => {
  console.error(error);
  const { alert } = await import("../src/lib/telegram");
  await alert("digest", `Digest failed\n\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
