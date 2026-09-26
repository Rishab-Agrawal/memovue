"use server";

import { AUTOMATED_MESSAGE, type BotSignals, looksAutomated } from "@/lib/bot-check";
import { sendCodeRequest } from "@/lib/email";
import { callerIp, rateLimit } from "@/lib/ratelimit";
import { recordRequest } from "@/lib/referrals";
import { sendCodeRequestToTelegram } from "@/lib/telegram";
import { type ActionResult, codeRequestSchema, firstError } from "@/lib/validation";

/** Asking for a referral code, from the Create dialog. Open to anyone, as the wizard is. */
export async function requestCodeAction(
  input: { email: string } & BotSignals,
): Promise<ActionResult> {
  // Before the rate limit, so a script cannot spend a person's budget.
  if (looksAutomated(input)) return { ok: false, error: AUTOMATED_MESSAGE };

  const parsed = codeRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  if (!rateLimit(`code-request:${await callerIp()}`, 3, 3_600).ok) {
    return { ok: false, error: "You've already asked. We'll be in touch shortly." };
  }

  const { email } = parsed.data;
  // Stored first, since both notifications swallow their own failures.
  await recordRequest(email);
  await Promise.all([sendCodeRequest(email), sendCodeRequestToTelegram(email)]);

  return { ok: true };
}
