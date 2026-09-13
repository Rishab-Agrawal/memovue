import { Resend } from "resend";

import { messageOf } from "./alert-text";
import { env } from "./env";
import { alert } from "./telegram";

/** Optional: without RESEND_API_KEY messages are logged instead of sent. */

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
    const { error } = await service.emails.send({ from: env.emailFrom, to, subject, text });
    // Resend reports a refusal (e.g. quota) in the body, not by throwing.
    if (error) throw new Error(`${error.name}: ${error.message}`);
  } catch (error) {
    // Never breaks the action that sent it, but never silent either: nobody can see an email
    // that did not arrive. `shouldAlert` dedupes a night of failures into one alert.
    console.error("Failed to send email", error);
    await alert("email", {
      what: "An email the site tried to send did not go out.",
      meaning:
        `Someone was not told “${subject}”. The site itself is fine, but for as long as this`
        + " goes on, hosts stop hearing things like their photos being about to be deleted.",
      action:
        "If the detail below mentions a quota, a limit or 429, the free email plan (100 a day,"
        + " 3,000 a month) has run out — nothing is charged and it resets on its own. Anything"
        + " else: send this whole message to Claude.",
      detail: `to: ${to}\n${messageOf(error)}`,
    });
  }
}

/**
 * A beta access request, forwarded to `ADMIN_EMAIL`. Without one it returns quietly: the
 * request is already stored and listed on the admin screen.
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

/** Beta access granted: sent when an address goes from no rolls to some. */
export function sendAccessGranted(to: string): Promise<void> {
  return send(
    to,
    "You're in: MemoVue beta access",
    `Hi,\n\nYou've been given beta access to MemoVue, so you can now create a roll for your ` +
      `event.\n\nSign in with Google using this email address and start one here:\n` +
      `${env.appUrl}/rolls\n\nIf you want to share any feedback, kindly write back to us: ` +
      `hello@memovue.com\n\nSincerely,\nMemoVue`,
  );
}

/** Retention warning, sent once (recorded by `warnedAt`) a week before `keptUntil`. */
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
 * The roll has taken its last guest. Sent by the join that filled it, so it fires once per
 * limit with no column: later joins are refused first, and raising the limit re-arms it.
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
