"use server";

import { after } from "next/server";

import { BetaAccessError } from "@/lib/beta";
import { rateLimit } from "@/lib/ratelimit";
import { createRoll } from "@/lib/rolls";
import { requireHost } from "@/lib/session";
import { notify } from "@/lib/telegram";
import { createRollSchema, fieldErrors } from "@/lib/validation";

export type CreateRollResult =
  | { ok: true; rollId: string; code: string; name: string }
  /** `noAccess` is what the wizard opens the request form on, rather than matching a string. */
  | { ok: false; error: string; noAccess?: boolean; fields?: Record<string, string> };

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

  /*
    The allowance is what says how many rolls this account may have; this says how fast.

    They are not the same bound, because deleting a roll that has not started yet gives the
    allowance back — so create-and-delete is free forever, and each pass writes a roll, walks
    its objects out of R2 and refunds itself. The allowance never notices. An admin, who is
    not on the list at all, is bounded by nothing else whatsoever.
  */
  if (!rateLimit(`create-roll:${user.id}`, 20, 3_600).ok) {
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

  try {
    const roll = await createRoll(user, {
      ...data,
      startsAt: new Date(data.startsAt),
      finishesAt: new Date(data.finishesAt),
    });

    /*
      Announced, not counted: `Roll` rows carry a `createdAt`, so the digest can count these
      to the day forever. What a message adds is the one thing a query never will — knowing on
      the evening it happens that somebody is setting up a party.
    */
    after(() =>
      notify(
        "signals",
        `New roll — “${roll.name}” · ${user.name} · ${data.maxGuests} guests × ${data.photosPerGuest} shots`,
      ),
    );

    return { ok: true, rollId: roll.id, code: roll.code, name: roll.name };
  } catch (error) {
    if (error instanceof BetaAccessError) {
      return { ok: false, error: error.message, noAccess: true };
    }
    throw error;
  }
}
