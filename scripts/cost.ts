import "./load-env";

/**
 * The cost watch. A fourth Railway cron service off this same repo, every four hours.
 *
 * It stops nothing. Railway does that itself, at its own meter, when the cycle's usage reaches
 * the hard limit set on the account — see the long note at the top of `src/lib/cost.ts` for
 * why the switch has to live there and not in a script that can fail to run. Everything here
 * is about being *told*, on the channel that is actually read.
 *
 * Three things, in the order they matter:
 *
 * 1. Whether the account still has both limits at all. A stop that has been removed from a
 *    dashboard is a stop that reports nothing when it fails to happen, and this is the only
 *    place that would ever notice. It checks that they *exist*, never what they say — the
 *    numbers are Railway's to hold and are read back live, so raising the limit for a busy
 *    month is a dashboard edit and not a deploy.
 * 2. Whether either meter could be read at all. A blind cost alarm looks exactly like a cheap
 *    month, so silence is never allowed to mean "nothing to report".
 * 3. Whether the money is over the line.
 *
 * Separate from the digest rather than a section in it, for the same reason the digest's own
 * heartbeat alert is separate: the digest is deliberately safe to skip, and nothing that needs
 * acting on today can live in a message whose whole design is that missing one costs nothing.
 *
 * It repeats while the money is over the line, on purpose. Six messages a day is the right
 * amount of nagging about a bill that is still climbing, and the way to stop it is to fix the
 * spend or raise the email alert in Railway — not to be told once and forget by lunchtime.
 *
 * Every four hours rather than nightly for two reasons: it puts a ceiling of four hours on how
 * long a runaway can go unannounced, and it guarantees a tick inside every Kolkata day
 * whatever hour the digest runs at, so the digest can tell that this job has stopped.
 *
 *   npm run cost           # read both meters, alert if anything is wrong
 *   npm run cost -- --dry  # print the same reading and send nothing
 *
 * There is deliberately no command here that writes a limit. Both are set on the Workspace
 * Usage page, which takes ten seconds and is the only place they take effect; a `--set-limits`
 * that pushed numbers from a text editor would, the first time the two disagreed, quietly
 * *raise* a limit somebody had tightened on purpose.
 */
async function main() {
  // Imported here rather than at the top: `env.ts` reads process.env the moment it loads
  // and throws on anything missing, so nothing may be imported before `load-env`.
  const { env } = await import("../src/lib/env");
  const { R2_ALERT_USD, costLines, costs } = await import("../src/lib/cost");
  const { record } = await import("../src/lib/metrics");
  const { alert } = await import("../src/lib/telegram");

  const usagePage = "https://railway.com/workspace/usage";
  const dollars = (usd: number | null | undefined) => (usd == null ? "none set" : `$${usd}`);

  const cost = await costs(env.cost);
  console.log(costLines(cost).join("\n"));
  // The account's own two numbers, which is where they live and the only place they act.
  console.log(
    `  Railway: emails at ${dollars(cost.limits?.soft)}`
      + `, stops everything at ${dollars(cost.limits?.hard)}`,
  );
  for (const failure of cost.failed) console.error(`UNREADABLE: ${failure}`);

  if (process.argv.includes("--dry")) return;

  /*
    A heartbeat, so the digest can notice this job having quietly stopped. Written for having
    run, not for having liked what it found — the three alerts below say what it found.
  */
  await record("cost_ok");

  /*
    That both limits exist — never what they say.

    Whatever numbers are on the account are somebody's considered choice, and this has no
    business second-guessing them or nagging until a constant in a repo is edited to agree.
    What is never a considered choice is *neither*: a limit that has been cleared, or an
    account that never had one, leaves nothing anywhere that stops the bill, and the whole
    design above rests on that switch being there. Only assertable when Railway answered;
    otherwise the failure below already says so.
  */
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
    // Non-zero so Railway marks the run red as well, rather than this being the only trace.
    process.exitCode = 1;
  }

  /*
    R2 on its own, because there is nothing at Cloudflare that can stop it.

    Railway's hard limit does not reach here: `cdn.memovue.com` is served from Cloudflare's
    edge with no part of Railway in the path, so reads and stored bytes go on being billed
    after every workload is offline — and this watch is offline with them, which is precisely
    why the threshold is low enough to fire long before that. Cloudflare offers no spend cap
    and no usage notification for R2, so this message is the only warning there is.
  */
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

  /*
    The line is Railway's email alert, read live off the account — so the Telegram message and
    Railway's own email fire at the same figure, and moving one moves both. No threshold to
    compare against means no message: an account with no email alert set has already been
    alerted about above, and inventing a number here would be the drift this design removes.
  */
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
  // Imported here too, because this runs outside `main` and therefore outside its imports —
  // and because the thing most likely to have thrown is one of them.
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
