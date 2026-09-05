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
 * A beta access request, forwarded to whoever owns `ADMIN_EMAIL`.
 *
 * The address it carries is the one the person is signed in with, because that is the string
 * the admin screen needs typed back in — a request naming any other address would grant
 * access to an account that will never arrive.
 *
 * Returns quietly when no admin address is configured: the row is already in `BetaRequest`
 * and the admin screen lists it, so a missing env var costs a notification, not the request.
 */
export function sendBetaRequest(request: {
  email: string;
  name: string;
  phone?: string | null;
  eventType: string;
  remarks?: string | null;
}): Promise<void> {
  if (!env.adminEmail) {
    console.info(`[beta request: no ADMIN_EMAIL] ${request.email}`);
    return Promise.resolve();
  }

  return send(
    env.adminEmail,
    `Beta access requested by ${request.name}`,
    [
      `Account: ${request.email}`,
      `Name: ${request.name}`,
      `Phone: ${request.phone || "—"}`,
      `Event: ${request.eventType}`,
      `Remarks: ${request.remarks || "—"}`,
      "",
      `Add the account address above at ${env.appUrl}/admin`,
    ].join("\n"),
  );
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

/**
 * The roll has taken its last guest, sent to the host by the join that filled it.
 *
 * That join is what makes this fire exactly once per limit without a column to remember it:
 * every later attempt is refused before it gets here, and raising the limit is what arms it
 * again. Worth interrupting a host for, because the alternative is people at the door being
 * turned away while the person who could fix it is holding a drink.
 */
export function sendRollFullNotice(to: string, eventName: string, maxGuests: number): Promise<void> {
  return send(
    to,
    `"${eventName}" is full`,
    `All ${maxGuests} spots on "${eventName}" have been taken, so anyone else who scans the ` +
      `code will be turned away.\n\nRaise the limit from the People screen:\n` +
      `${env.appUrl}/rolls\n\n— MemoVue`,
  );
}
