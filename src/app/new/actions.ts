"use server";

import { CouponError } from "@/lib/coupons";
import { createRoll } from "@/lib/rolls";
import { requireHost } from "@/lib/session";
import { createRollSchema, fieldErrors } from "@/lib/validation";

export type CreateRollResult =
  | { ok: true; rollId: string; code: string; name: string }
  | { ok: false; error: string; fields?: Record<string, string> };

/**
 * The wizard's only write.
 *
 * Everything the client clamped — the calendars, the tier lists — is re-checked here. A form
 * post is trivially replayed with different numbers, so the client's version of the rules is
 * a convenience and this is the rule.
 */
export async function createRollAction(
  input: Record<string, unknown>,
): Promise<CreateRollResult> {
  const user = await requireHost();

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

  try {
    const roll = await createRoll(user.id, {
      ...data,
      startsAt: new Date(data.startsAt),
      finishesAt: new Date(data.finishesAt),
    });

    return { ok: true, rollId: roll.id, code: roll.code, name: roll.name };
  } catch (error) {
    if (error instanceof CouponError) {
      return { ok: false, error: error.message, fields: { couponCode: error.message } };
    }
    throw error;
  }
}
