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

export const emailEnabled = Boolean(env.resendApiKey);

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

export function sendAccessApproved(to: string, name: string): Promise<void> {
  return send(
    to,
    "You're in — MemoVue is ready for your event",
    `Hi ${name.split(" ")[0]},\n\n` +
      `Your MemoVue account is approved. You can set up your event and get your QR code here:\n` +
      `${env.appUrl}/dashboard/new\n\n` +
      `If anything is confusing, just reply to this email.\n\n— MemoVue`,
  );
}

export function sendAccessDenied(to: string, name: string): Promise<void> {
  return send(
    to,
    "About your MemoVue request",
    `Hi ${name.split(" ")[0]},\n\n` +
      `We aren't able to approve your account for the beta right now. If you think that's a ` +
      `mistake, reply to this email and we'll take another look.\n\n— MemoVue`,
  );
}

/**
 * Retention warning. Albums are kept indefinitely by default; if that ever has to change
 * for a specific event, the host gets 30 days' notice to download everything first.
 */
export function sendDeletionNotice(to: string, eventName: string, deleteOn: Date): Promise<void> {
  return send(
    to,
    `Action needed: "${eventName}" photos will be deleted`,
    `Your MemoVue album "${eventName}" is scheduled for deletion on ` +
      `${deleteOn.toDateString()}.\n\n` +
      `Download everything before then from your dashboard:\n${env.appUrl}/dashboard\n\n— MemoVue`,
  );
}
