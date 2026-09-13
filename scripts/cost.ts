import "./load-env";

/**
 * The cost watch: a Railway cron every four hours. It stops nothing — Railway's hard limit does
 * that (see `src/lib/cost.ts`) — it makes sure we are told, in order:
 *
 * 1. Railway still has both an email alert and a hard limit set. Their values are Railway's.
 * 2. Both meters could be read. A blind cost alarm looks exactly like a cheap month.
 * 3. Whether spend is over the line. This repeats every run while it stays over.
 *
 * Separate from the digest, which is safe to skip. Every four hours also guarantees a heartbeat
 * inside every day, so the digest can tell if this stopped.
 *
 *   npm run cost           # read both meters, alert if anything is wrong
 *   npm run cost -- --dry  # print the same reading and send nothing
 */
async function main() {
  // Imported after `load-env`, because `env.ts` reads process.env the moment it loads.
  const { env } = await import("../src/lib/env");
  const { R2_ALERT_USD, costLines, costs } = await import("../src/lib/cost");
  const { record } = await import("../src/lib/metrics");
  const { alert } = await import("../src/lib/telegram");

  const usagePage = "https://railway.com/workspace/usage";
  const dollars = (usd: number | null | undefined) => (usd == null ? "none set" : `$${usd}`);

  const cost = await costs(env.cost);
  console.log(costLines(cost).join("\n"));
  console.log(
    `  Railway: emails at ${dollars(cost.limits?.soft)}`
      + `, stops everything at ${dollars(cost.limits?.hard)}`,
  );
  for (const failure of cost.failed) console.error(`UNREADABLE: ${failure}`);

  if (process.argv.includes("--dry")) return;

  // A heartbeat for having run; the alerts below say what it found.
  await record("cost_ok");

  // That both limits exist, never what they say. Only checkable when Railway answered.
  if (cost.railway !== null && (cost.limits?.hard == null || cost.limits?.soft == null)) {
    const noStop = cost.limits?.hard == null;
    await alert("cost-limits", {
      what: noStop
        ? "Railway has no spending limit set, so nothing will stop the bill."
        : "Railway has no billing email alert set.",
      meaning: noStop
        ? "If usage ran away, nothing would stop it. That limit is the only thing that actually"
          + " stops spending — nothing in the app can."
        : "Railway will not email you before the spending limit is reached, so the first sign of"
          + " a large bill would be the site going offline.",
      action: `Set it on Railway's usage page — any amount, $10 minimum: ${usagePage}`,
      detail:
        `stops everything at ${dollars(cost.limits?.hard)}`
        + ` · emails at ${dollars(cost.limits?.soft)}`,
    });
  }

  if (cost.failed.length > 0) {
    await alert("cost-blind", {
      what: `The cost watch could not read ${cost.failed.length === 1 ? "one of the two bills" : "either bill"}.`,
      meaning:
        `The $${cost.total.toFixed(2)} it could see is only part of the bill, so until this is`
        + " fixed a large bill would look like a small one.",
      action:
        "If the next check (in four hours) says the same, send this to Claude — it is usually"
        + " an API token that has expired or been removed.",
      detail: cost.failed.join("\n"),
    });
    // Non-zero so Railway marks the run as failed too.
    process.exitCode = 1;
  }

  // R2 on its own: Railway's hard stop does not reach Cloudflare, and R2 has no cap of its own.
  if (cost.r2 !== null && cost.r2 >= R2_ALERT_USD) {
    await alert("cost-r2", {
      what: `Photo storage (Cloudflare R2) has cost over $${R2_ALERT_USD} this month.`,
      meaning:
        "Nothing stops this bill automatically: Cloudflare has no spending cap, and the photos"
        + " are served whether or not the site is running.",
      action:
        "Send this to Claude to find out which rolls are using the space, and whether anything"
        + " should be deleted early.",
      detail: costLines(cost).map((line) => line.trim()).join("\n"),
    });
  }

  // The line is Railway's own email alert, read live, so Telegram and Railway fire together.
  if (cost.limits?.soft != null && cost.total >= cost.limits.soft) {
    await alert("cost-over", {
      what: `Hosting has cost over $${cost.limits.soft} this billing cycle.`,
      meaning:
        `At ${dollars(cost.limits.hard)} Railway takes everything offline — every project in the`
        + " workspace, not only MemoVue. This repeats every four hours while it stays over.",
      action: `Reduce usage, or raise the limits on Railway's usage page: ${usagePage}`,
      detail: costLines(cost).map((line) => line.trim()).join("\n"),
    });
  }
}

main().catch(async (error) => {
  console.error(error);
  // Imported here too: whatever threw may have been one of `main`'s imports.
  const { alert } = await import("../src/lib/telegram");
  const { messageOf } = await import("../src/lib/alert-text");
  await alert("cost", {
    what: "The cost watch crashed.",
    meaning:
      "Nothing checked the bill this time. Railway's own spending limit still applies, so the"
      + " spend is still capped. It runs again in four hours.",
    action: "Nothing yet. If this keeps arriving, send it to Claude.",
    detail: messageOf(error),
  });
  process.exit(1);
});
