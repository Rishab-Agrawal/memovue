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

/** Every email is one of these: the greeting and sign-off live here, each sender writes the body. */
async function send(to: string, subject: string, body: string): Promise<void> {
  const service = resend();
  if (!service) {
    console.info(`[email skipped: no RESEND_API_KEY] to=${to} subject=${subject}`);
    return;
  }

  const text = `Hi,\n\n${body}\n\nWarm Regards,\nMemovue`;

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
 * A referral code request, forwarded to `ADMIN_EMAIL`. Without one it returns quietly: the
 * request is already stored and listed on the admin screen.
 */
export function sendCodeRequest(email: string): Promise<void> {
  if (!env.adminEmail) {
    console.info(`[code request: no ADMIN_EMAIL] ${email}`);
    return Promise.resolve();
  }

  return send(
    env.adminEmail,
    `Referral code requested by ${email}`,
    `${email} asked for a referral code.\n\nMake them one at ${env.appUrl}/admin/referrals`,
  );
}

/** The person who asked, told that somebody will. */
export function sendRequestReceived(to: string): Promise<void> {
  return send(
    to,
    "We've received your request",
    "We have received your request for a referral code, and will get back to you soon!",
  );
}

/** A code, sent by an admin from the referral codes screen. */
export function sendReferralCode(to: string, code: string): Promise<void> {
  return send(to, "Your Memovue referral code", `Welcome to Memovue! Your referral code is ${code}.`);
}

/**
 * A wedding business, told that their code was used. It says the one thing it is for and
 * nothing else — no link, no unsubscribe copy for a list of one message per roll they
 * themselves caused.
 */
export function sendReferralRollCreated(to: string, rollName: string): Promise<void> {
  return send(
    to,
    "A new roll was created with your referral code",
    `A new roll named "${rollName}" has been created at Memovue using your referral code!`,
  );
}

/** Retention warning, sent once (recorded by `warnedAt`) a week before `keptUntil`. */
export function sendDeletionNotice(to: string, eventName: string, deleteOn: Date): Promise<void> {
  return send(
    to,
    `Action needed: "${eventName}" photos will be deleted`,
    `Your MemoVue album "${eventName}" is scheduled for deletion on ` +
      `${deleteOn.toDateString()}.\n\n` +
      `Download everything before then:\n${env.appUrl}/rolls`,
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
      `${env.appUrl}/rolls`,
  );
}
