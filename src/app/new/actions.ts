"use server";

import { after } from "next/server";

import { BetaAccessError } from "@/lib/beta";
import { REFERRALS } from "@/lib/constants";
import { record } from "@/lib/metrics";
import { callerIp, rateLimit } from "@/lib/ratelimit";
import { findReferrer } from "@/lib/referrals";
import { createRoll } from "@/lib/rolls";
import { requireHost } from "@/lib/session";
import { notify } from "@/lib/telegram";
import { checkReferralSchema, createRollSchema, fieldErrors } from "@/lib/validation";

/** What a code that names nobody is told, in the wizard and at creation alike. */
const NO_SUCH_CODE = "We don't know that referral code. Check it with whoever gave it to you.";

/**
 * Step one's Next button, when a referral code has been typed.
 *
 * Open to anyone — the wizard is — so it is a guessing oracle, and the only defence that makes
 * sense is how fast an address may guess. Codes are handed out by businesses to their own
 * customers, and the prize for a lucky guess is somebody else's logo on your wedding album.
 */
export async function checkReferralAction(
  input: Record<string, unknown>,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  if (!REFERRALS) return { ok: false, error: NO_SUCH_CODE };

  if (!rateLimit(`referral:${await callerIp()}`, 20, 600).ok) {
    return { ok: false, error: "Too many tries — give that a minute." };
  }

  const parsed = checkReferralSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: NO_SUCH_CODE };

  const referrer = await findReferrer(parsed.data.code);
  return referrer ? { ok: true, name: referrer.name } : { ok: false, error: NO_SUCH_CODE };
}

type CreateRollResult =
  | { ok: true; rollId: string; code: string; name: string }
  /** `noAccess` is what the wizard opens the request form on, rather than matching a string. */
  | { ok: false; error: string; noAccess?: boolean; fields?: Record<string, string> };

/** The wizard's only write. Everything the client clamped is re-checked here. */
export async function createRollAction(
  input: Record<string, unknown>,
): Promise<CreateRollResult> {
  const user = await requireHost();

  // Rate, per account and per IP. The allowance bounds count, not speed, and admins have no
  // allowance; accounts are free, so the address is counted too.
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

  /*
    The code is resolved again here, not trusted from the step that checked it: this is the
    write, and the input arrived from a browser. A code that was retired between the two — or
    never checked at all — refuses the roll rather than quietly creating one with nobody
    credited, which is the failure the business would never hear about.
  */
  const referrer = REFERRALS && data.referralCode ? await findReferrer(data.referralCode) : null;
  if (data.referralCode && !referrer) {
    return { ok: false, error: NO_SUCH_CODE, fields: { referralCode: NO_SUCH_CODE } };
  }

  try {
    const roll = await createRoll(user, {
      ...data,
      referrerId: referrer?.id ?? null,
      startsAt: new Date(data.startsAt),
      finishesAt: new Date(data.finishesAt),
    });

    // Tallied because roll rows get deleted (see `digest.ts`), and announced as it happens.
    after(() =>
      Promise.all([
        record("roll_created"),
        notify(
          "signals",
          `New roll — “${roll.name}” · ${user.name} · ${data.maxGuests} guests × ${data.photosPerGuest} shots` +
            (referrer ? `\nReferred by ${referrer.name}` : ""),
        ),
      ]),
    );

    return { ok: true, rollId: roll.id, code: roll.code, name: roll.name };
  } catch (error) {
    if (error instanceof BetaAccessError) {
      return { ok: false, error: error.message, noAccess: true };
    }
    throw error;
  }
}
