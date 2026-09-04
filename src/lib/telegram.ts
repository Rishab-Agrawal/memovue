import "server-only";

import { env } from "./env";

/**
 * A message to the owner's phone.
 *
 * This exists because email to yourself is the flakiest possible notification channel: our
 * DMARC is still `p=none`, `sendBetaRequest` swallows its own failures on purpose, and a beta
 * request that lands in spam is a customer who waited three days for nothing. Telegram has no
 * domain, no DNS and no deliverability — the request either posts or it throws, and it buzzes
 * a phone rather than joining a pile.
 *
 * It does not replace the `BetaRequest` row. Two best-effort notifications and one durable
 * record is the right shape; three best-effort notifications is not.
 */

/**
 * Capped, because this runs inline in a server action somebody is watching a spinner for.
 * A Telegram outage must cost them five seconds, not the whole request.
 */
const TIMEOUT_MS = 5_000;

async function send(text: string): Promise<void> {
  if (!env.telegram) {
    console.info("[telegram skipped: not configured]");
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
          text,
          // The admin link at the bottom would otherwise drag a link card into every message.
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );

    // Telegram answers 200 with `{ok:false}` for some failures and 4xx for others, so both
    // are worth logging — a bot that was never started by its owner fails here forever.
    if (!response.ok) {
      console.error("Telegram refused the message", response.status, await response.text());
    }
  } catch (error) {
    // Same rule as email: a failed notification must never break the action behind it.
    console.error("Failed to send Telegram message", error);
  }
}

/** The same beta request `sendBetaRequest` emails, as one message you can read on a lock screen. */
export function sendBetaRequestToTelegram(request: {
  email: string;
  name: string;
  phone?: string | null;
  eventType: string;
  remarks?: string | null;
}): Promise<void> {
  return send(
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
