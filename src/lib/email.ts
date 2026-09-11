import { Resend } from "resend";

import { messageOf } from "./alert-text";
import { env } from "./env";
import { alert } from "./telegram";

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
    const { error } = await service.emails.send({ from: env.emailFrom, to, subject, text });
    // Resend reports a refusal in the body rather than by throwing, so a quota that has run
    // out returns an ordinary resolved promise. Without reading this, the only failure mode
    // that costs a host their photographs is also the only one that looks like success.
    if (error) throw new Error(`${error.name}: ${error.message}`);
  } catch (error) {
    /*
      A failed notification must never break the action that triggered it — but it must not
      pass in silence either, which is what this used to do.

      Every message this app sends is one a person cannot find out by looking: a roll about to
      be deleted, a roll that has filled up at the door. Console-logging that is the same as
      losing it. The free Resend plan is 3,000 a month and 100 a day and refuses with a 429
      rather than billing, so running out costs nothing and breaks quietly — the worst pair of
      properties a failure can have, and the same pair `env.ts` refuses to allow R2 to have.

      Deduplicated by `shouldAlert`, so a sweep night that cannot reach Resend at all reports
      one fault rather than one per host.
    */
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
 * Beta access granted, sent when the admin screen takes an address from no rolls to some —
 * a new address on the list, or a `+` on one sitting at zero. Not on a top-up: somebody who
 * still has rolls left already knows they are in.
 */
export function sendAccessGranted(to: string): Promise<void> {
  return send(
    to,
    "You're in: MemoVue beta access",
    `Good news — you've been given beta access to MemoVue, so you can now create a roll ` +
      `for your event.\n\nSign in with Google using this address (${to}) and start one here:\n` +
      `${env.appUrl}/rolls\n\n— MemoVue`,
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
