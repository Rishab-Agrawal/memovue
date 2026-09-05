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
 * Run it by hand with `npm run digest`, which prints the same message it sends.
 */
async function main() {
  // After dotenv, because `env.ts` reads process.env at module scope and throws on anything
  // missing.
  const { buildDigest } = await import("../src/lib/digest");
  const { notify } = await import("../src/lib/telegram");

  const text = await buildDigest();
  console.log(text);

  if (!process.argv.includes("--dry")) await notify("daily", text);
}

main().catch(async (error) => {
  console.error(error);
  const { alert } = await import("../src/lib/telegram");
  await alert("digest", `Digest failed\n\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
