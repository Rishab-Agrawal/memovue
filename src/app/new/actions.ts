"use server";

import { after } from "next/server";

import { BetaAccessError } from "@/lib/beta";
import { record } from "@/lib/metrics";
import { callerIp, rateLimit } from "@/lib/ratelimit";
import { createRoll } from "@/lib/rolls";
import { requireHost } from "@/lib/session";
import { notify } from "@/lib/telegram";
import { createRollSchema, fieldErrors } from "@/lib/validation";

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

  try {
    const roll = await createRoll(user, {
      ...data,
      startsAt: new Date(data.startsAt),
      finishesAt: new Date(data.finishesAt),
    });

    // Tallied because roll rows get deleted (see `digest.ts`), and announced as it happens.
    after(() =>
      Promise.all([
        record("roll_created"),
        notify(
          "signals",
          `New roll — “${roll.name}” · ${user.name} · ${data.maxGuests} guests × ${data.photosPerGuest} shots`,
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
