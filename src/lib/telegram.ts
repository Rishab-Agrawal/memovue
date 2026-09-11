import "server-only";

import { type Alert, renderAlert } from "./alert-text";
import { env } from "./env";
import { shouldAlert } from "./ratelimit";

/**
 * Everything the owner needs to know, on the owner's phone.
 *
 * This exists because email to yourself is the flakiest possible notification channel:
 * `sendBetaRequest` swallows its own failures on purpose, and a beta request that lands in
 * spam is a customer who waited three days for nothing. Telegram has no domain, no DNS and no
 * deliverability — the request either posts or it throws, and it buzzes a phone rather than
 * joining a pile.
 *
 * Three topics in one group, because they are read at three different speeds:
 *
 * - `alerts` is the only one that should ever interrupt anybody. Something is broken.
 * - `signals` is the pulse: a person signed up, a roll was created, somebody asked to be let
 *   in. Pleasant to read, never urgent, and each message is one line.
 * - `daily` is the digest, once a morning.
 * - `query` is the one that talks back: the answers to `/rolls`, see `app/api/telegram`.
 *
 * A message is never a record. The `BetaRequest` row, the `Metric` tally and the exception in
 * Railway's log all outlive whatever was sent here, and nothing in the app waits on a send.
 *
 * And none of it is ever sent from a laptop — see `post`, which is the only sender.
 */

type Topic = "alerts" | "signals" | "daily" | "query";

/**
 * Capped, because some of these run inline in a request somebody is watching a spinner for.
 * A Telegram outage must cost them five seconds, not the whole request.
 */
const TIMEOUT_MS = 5_000;

async function post(topic: Topic, text: string): Promise<void> {
  if (!env.telegram) {
    console.info(`[telegram skipped: not configured] ${topic}: ${text}`);
    return;
  }

  /*
    Nothing is sent from a development machine.

    `.env.local` holds the same token, the same chat id and the same three topic ids as the
    deployment, because a notification channel that cannot be exercised before it ships is one
    nobody finds out is broken until the night it matters. What that costs, until this line,
    is that `npm run dev` and `npm test` wrote into the live group: the end-to-end suite
    announced a new host and a new roll for every fixture it made, and a dev server whose
    compile worker died sent “Jest worker encountered 2 child process exceptions, exceeding
    retry limit” — a sentence about Next's own build tooling on a laptop — to the one topic
    that is allowed to wake somebody up.

    That is worse than noise. Alerts is read on the assumption that everything in it is real
    and is about the deployed site, so a message that is neither does not merely waste a
    glance; it teaches the reader to skim, and the next one is a wedding going wrong.

    A console line rather than silence, so `npm run digest` and the other scripts still show
    locally exactly what they would have sent. `npm run verify:telegram` is deliberately not
    routed through here — proving a send works from wherever you are standing is its entire
    job, so it posts to the Telegram API itself.
  */
  if (!env.isDeployed) {
    console.info(`[telegram skipped: not a deployment] ${topic}: ${text}`);
    return;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.telegram.token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: env.telegram.chatId,
          // Absent unless the group has forum topics turned on, in which case the message
          // lands in General — delivered but unsorted, which is the right way to degrade.
          message_thread_id: env.telegram.topics[topic],
          // Deliberately no `parse_mode`. Some of this text originates in a browser we do not
          // control, and plain text is the one format that cannot be made to mean something.
          text,
          // The admin link at the bottom would otherwise drag a link card into every message.
          disable_web_page_preview: true,
          // Only alerts are worth waking somebody for.
          disable_notification: topic !== "alerts",
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );

    // Telegram answers 200 with `{ok:false}` for some failures and 4xx for others, so both
    // are worth logging — a bot that was never started by its owner fails here forever, and
    // so does a thread id that names a topic somebody has since deleted.
    if (!response.ok) {
      console.error("Telegram refused the message", response.status, await response.text());
    }
  } catch (error) {
    // Same rule as email: a failed notification must never break the action behind it.
    console.error("Failed to send Telegram message", error);
  }
}

/* ------------------------------------------------------------------ alerts */

/**
 * Something is broken. `key` is what makes two of these the same fault — a route and a
 * message, a script's name — so that a loop is announced once rather than a thousand times.
 * The budget itself lives with every other budget in the app, in `ratelimit.ts`.
 *
 * It takes an `Alert`, not text, and that is the whole of the rule in `alert-text.ts`: the
 * only way into this topic is sentences written in this repo — what happened, what it means,
 * what to do — with whatever a machine said kept below them, labelled.
 */
export async function alert(key: string, message: Alert): Promise<void> {
  if (!shouldAlert(key)) return;
  await post("alerts", renderAlert(message));
}

/**
 * Signals and the digest. Never alerts: `alert` is the only way in there, so nothing can put a
 * bare line out of a stack trace into the one topic that is allowed to wake anybody up.
 */
export function notify(topic: Exclude<Topic, "alerts">, text: string): Promise<void> {
  return post(topic, text);
}

/* ------------------------------------------------------------------ signals */

/** The same beta request `sendBetaRequest` emails, as one message you can read on a lock screen. */
export function sendBetaRequestToTelegram(request: {
  email: string;
  name: string;
  phone?: string | null;
  eventType: string;
  remarks?: string | null;
}): Promise<void> {
  return notify(
    "signals",
    [
      `Beta access requested — ${request.eventType}`,
      "",
      request.name,
      request.email,
      request.phone ? request.phone : null,
      request.remarks ? `“${request.remarks}”` : null,
      "",
      `Allow it: ${env.appUrl}/admin`,
    ]
      .filter((line) => line !== null)
      .join("\n"),
  );
}
