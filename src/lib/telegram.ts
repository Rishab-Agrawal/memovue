import "server-only";

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
 *
 * A message is never a record. The `BetaRequest` row, the `Metric` tally and the exception in
 * Railway's log all outlive whatever was sent here, and nothing in the app waits on a send.
 */

export type Topic = "alerts" | "signals" | "daily";

/**
 * Capped, because some of these run inline in a request somebody is watching a spinner for.
 * A Telegram outage must cost them five seconds, not the whole request.
 */
const TIMEOUT_MS = 5_000;

export async function notify(topic: Topic, text: string): Promise<void> {
  if (!env.telegram) {
    console.info(`[telegram skipped: not configured] ${topic}: ${text}`);
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
 */
export async function alert(key: string, text: string): Promise<void> {
  if (!shouldAlert(key)) return;
  await notify("alerts", text);
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
