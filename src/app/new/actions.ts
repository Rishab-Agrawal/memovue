"use server";

import { after } from "next/server";

import { sendReferralRollCreated } from "@/lib/email";
import { record } from "@/lib/metrics";
import { callerIp, rateLimit } from "@/lib/ratelimit";
import { CodeSpentError, findReferrer, isSpent } from "@/lib/referrals";
import { createRoll } from "@/lib/rolls";
import { requireHost } from "@/lib/session";
import { notify } from "@/lib/telegram";
import {
  type ActionResult,
  checkReferralSchema,
  createRollSchema,
  fieldErrors,
} from "@/lib/validation";

/** What a code that names nobody is told, at the check and at creation alike. */
const NO_SUCH_CODE = "Code not found, please re-check.";
const SPENT_CODE = "This code has already been used.";

/**
 * The Create dialog's check, for somebody about to be sent to Google: finding out the code was
 * mistyped should not cost them a sign-in first.
 *
 * Open to anyone — the wizard is — so it is a guessing oracle, and the only defence that makes
 * sense is how fast an address may guess.
 */
export async function checkReferralAction(input: Record<string, unknown>): Promise<ActionResult> {
  if (!rateLimit(`referral:${await callerIp()}`, 20, 600).ok) {
    return { ok: false, error: "Too many tries — give that a minute." };
  }

  const parsed = checkReferralSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: NO_SUCH_CODE };

  const referrer = await findReferrer(parsed.data.code);
  if (!referrer) return { ok: false, error: NO_SUCH_CODE };
  return isSpent(referrer) ? { ok: false, error: SPENT_CODE } : { ok: true };
}

type CreateRollResult =
  | { ok: true; rollId: string; code: string; name: string }
  /** `fields.referralCode` is what the wizard shows under the code box, rather than a dialog. */
  | { ok: false; error: string; fields?: Record<string, string> };

/** The wizard's only write. Everything the client clamped is re-checked here. */
export async function createRollAction(
  input: Record<string, unknown>,
): Promise<CreateRollResult> {
  const user = await requireHost();

  // Rate, per account and per IP. Codes bound count, not speed, and accounts are free, so the
  // address is counted too.
  if (!rateLimit(`create-roll:${user.id}`, 20, 3_600).ok) {
    return { ok: false, error: "That's a lot of rolls at once. Try again shortly." };
  }
  if (!rateLimit(`create-roll-ip:${await callerIp()}`, 20, 3_600).ok) {
    return { ok: false, error: "That's a lot of rolls at once. Try again shortly." };
  }

  const parsed = createRollSchema.safeParse(input);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    return {
      ok: false,
      error: Object.values(fields)[0] ?? "Something in that form isn't right.",
      fields,
    };
  }

  const data = parsed.data;

  // Resolved here, not trusted from the dialog's check: this is the write, and the input
  // arrived from a browser. `createRoll` spends it, and refuses if the last use went meanwhile.
  const referrer = await findReferrer(data.referralCode);
  if (!referrer) {
    return { ok: false, error: NO_SUCH_CODE, fields: { referralCode: NO_SUCH_CODE } };
  }

  try {
    const roll = await createRoll(user, {
      ...data,
      referrer,
      startsAt: new Date(data.startsAt),
      finishesAt: new Date(data.finishesAt),
    });

    const business = referrer.kind === "BUSINESS";

    // Tallied because roll rows get deleted (see `digest.ts`), and announced as it happens.
    after(() =>
      Promise.all([
        record("roll_created"),
        // The business hears about the roll it brought in, if it asked to be told.
        referrer.email ? sendReferralRollCreated(referrer.email, roll.name) : null,
        notify(
          "signals",
          `New roll — “${roll.name}” · ${user.name} · ${data.maxGuests} guests × ${data.photosPerGuest} shots` +
            (business ? `\nReferred by ${referrer.name}` : `\nCode given to ${referrer.name}`),
        ),
      ]),
    );

    return { ok: true, rollId: roll.id, code: roll.code, name: roll.name };
  } catch (error) {
    if (error instanceof CodeSpentError) {
      return { ok: false, error: SPENT_CODE, fields: { referralCode: SPENT_CODE } };
    }
    throw error;
  }
}
