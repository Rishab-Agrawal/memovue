"use server";

import { recordRequest } from "@/lib/beta";
import { AUTOMATED_MESSAGE, type BotSignals, looksAutomated } from "@/lib/bot-check";
import { sendBetaRequest } from "@/lib/email";
import { rateLimit } from "@/lib/ratelimit";
import { requireHost } from "@/lib/session";
import { sendBetaRequestToTelegram } from "@/lib/telegram";
import { type ActionResult, betaRequestSchema, firstError } from "@/lib/validation";

/** Asking for beta access, offered from both the home screen and the wizard. */
export async function requestBetaAccessAction(
  input: { name: string; phone?: string; eventType: string; remarks?: string } & BotSignals,
): Promise<ActionResult> {
  const user = await requireHost();

  // Before the rate limit, so a script cannot spend the account's budget.
  if (looksAutomated(input)) return { ok: false, error: AUTOMATED_MESSAGE };

  const parsed = betaRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  if (!rateLimit(`beta-request:${user.id}`, 3, 3_600).ok) {
    return { ok: false, error: "You've already asked. We'll be in touch shortly." };
  }

  // The address comes from the session: it is the one an admin must allow.
  const request = { email: user.email, ...parsed.data };

  // Stored first, since both notifications swallow their own failures.
  await recordRequest(request);
  await Promise.all([sendBetaRequest(request), sendBetaRequestToTelegram(request)]);

  return { ok: true };
}
