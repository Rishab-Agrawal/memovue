import "server-only";

import { type Alert, renderAlert } from "./alert-text";
import { env } from "./env";
import { shouldAlert } from "./ratelimit";

/**
 * Owner notifications, on Telegram rather than email: a send either posts or fails, with no
 * spam folder. One group, four topics read at different speeds:
 *
 * - `alerts`: something is broken. The only one that notifies.
 * - `signals`: sign-ups, new rolls, access requests. One line each.
 * - `daily`: the morning digest.
 * - `query`: answers to `/rolls`, see `app/api/telegram`.
 *
 * A message is never a record, and nothing in the app waits on a send.
 */

type Topic = "alerts" | "signals" | "daily" | "query";

/** Some sends run inline in a request, so a Telegram outage costs five seconds at most. */
const TIMEOUT_MS = 5_000;

async function post(topic: Topic, text: string): Promise<void> {
  if (!env.telegram) {
    console.info(`[telegram skipped: not configured] ${topic}: ${text}`);
    return;
  }

  /*
    Nothing is sent from a development machine. `.env.local` shares the live bot config so the
    channel can be exercised, but dev servers and tests must not post into a group read on the
    assumption that everything in it is real. `npm run verify:telegram` posts directly instead.
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
          // Absent without forum topics, in which case it lands in General.
          message_thread_id: env.telegram.topics[topic],
          // No `parse_mode`: some text originates in a browser, and plain text cannot be made to mean anything.
          text,
          disable_web_page_preview: true,
          disable_notification: topic !== "alerts",
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      console.error("Telegram refused the message", response.status, await response.text());
    }
  } catch (error) {
    // A failed notification must never break the action behind it.
    console.error("Failed to send Telegram message", error);
  }
}

/* ------------------------------------------------------------------ alerts */

/**
 * Something is broken. `key` identifies the fault so a loop is announced once. Takes an
 * `Alert` rather than text, so the topic only ever carries sentences written in this repo.
 */
export async function alert(key: string, message: Alert): Promise<void> {
  if (!shouldAlert(key)) return;
  await post("alerts", renderAlert(message));
}

/** Signals and the digest. Never alerts: `alert` is the only way in there. */
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
