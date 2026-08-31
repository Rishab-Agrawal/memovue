import { Resend } from "resend";

import { env } from "./env";

/**
 * Email is optional infrastructure. Without RESEND_API_KEY the app still works end to end
 * — messages are logged instead of sent — so nothing about local development or the first
 * deploy is blocked on setting up a sending domain.
 */

let client: Resend | null = null;

function resend(): Resend | null {
  if (!env.resendApiKey) return null;
  client ??= new Resend(env.resendApiKey);
  return client;
}

async function send(to: string, subject: string, text: string): Promise<void> {
  const service = resend();
  if (!service) {
    console.info(`[email skipped: no RESEND_API_KEY] to=${to} subject=${subject}`);
    return;
  }

  try {
    await service.emails.send({ from: env.emailFrom, to, subject, text });
  } catch (error) {
    // A failed notification must never break the action that triggered it.
    console.error("Failed to send email", error);
  }
}

/**
 * Retention warning, sent once by the nightly sweep a week before a roll reaches its
 * `keptUntil`. The roll's `warnedAt` records the send, so a host hears about it once rather
 * than every night for a week.
 */
export function sendDeletionNotice(to: string, eventName: string, deleteOn: Date): Promise<void> {
  return send(
    to,
    `Action needed: "${eventName}" photos will be deleted`,
    `Your MemoVue album "${eventName}" is scheduled for deletion on ` +
      `${deleteOn.toDateString()}.\n\n` +
      `Download everything before then:\n${env.appUrl}/rolls\n\n— MemoVue`,
  );
}
