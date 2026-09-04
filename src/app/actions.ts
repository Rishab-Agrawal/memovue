"use server";

import { recordRequest } from "@/lib/beta";
import { sendBetaRequest } from "@/lib/email";
import { rateLimit } from "@/lib/ratelimit";
import { requireHost } from "@/lib/session";
import { sendBetaRequestToTelegram } from "@/lib/telegram";
import { betaRequestSchema, fieldErrors } from "@/lib/validation";

/**
 * Actions that belong to no single screen.
 *
 * Asking for beta access is offered from two places that share nothing else — the button on
 * the home screen, and the last step of the wizard when the allowance turns out to be spent —
 * so the action sits above both rather than in one of their folders.
 */

export type RequestAccessResult = { ok: true } | { ok: false; error: string };

export async function requestBetaAccessAction(
  input: { name: string; phone?: string; eventType: string; remarks?: string },
): Promise<RequestAccessResult> {
  const user = await requireHost();

  const parsed = betaRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: Object.values(fieldErrors(parsed.error))[0] ?? "Invalid" };
  }

  /*
    Keyed on the account rather than on the IP, because the form is behind sign-in and the
    account is the thing an admin has to act on. Three an hour is far more than anyone needs
    and far less than a script would send.
  */
  if (!rateLimit(`beta-request:${user.id}`, 3, 3_600).ok) {
    return { ok: false, error: "You've already asked. We'll be in touch shortly." };
  }

  // The address comes off the session, never off the form: it is the string an admin types
  // back into the allow-list, and it has to be the one this person will actually sign in as.
  const request = { email: user.email, ...parsed.data };

  /*
    Written first, then announced twice.

    Both notifications swallow their own failures so a submission never 500s, which makes the
    row the only copy guaranteed to survive — and it is why there are two of them. Email to
    oneself is the flakiest channel there is; Telegram has no deliverability to lose. Together
    they run in parallel, so the person waiting on the button waits for the slower one rather
    than for both.
  */
  await recordRequest(request);
  await Promise.all([sendBetaRequest(request), sendBetaRequestToTelegram(request)]);

  return { ok: true };
}
