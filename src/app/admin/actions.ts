"use server";

import { revalidatePath } from "next/cache";

import { adjustAccess, grantAccess, revokeAccess } from "@/lib/beta";
import { sendAccessGranted } from "@/lib/email";
import { rateLimit } from "@/lib/ratelimit";
import { requireAdmin } from "@/lib/session";
import {
  type ActionResult,
  adjustAccessSchema,
  firstError,
  grantAccessSchema,
  revokeAccessSchema,
} from "@/lib/validation";

/**
 * `requireAdmin`, with a ceiling on how fast the queue can be worked through.
 *
 * The threat here is not really an attacker — an admin session is already the keys to the
 * building, and a limit does not change that. It is that `−` and `+` are two buttons beside a
 * counter, one tap is one write, and a held finger or a stuck retry is an unbounded number of
 * them. Every action goes through here so a new one cannot forget it.
 */
async function withinAdminBudget(): Promise<ActionResult | null> {
  const user = await requireAdmin();
  if (rateLimit(`admin:${user.id}`, 120, 60).ok) return null;
  return { ok: false, error: "Too fast — give that a second." };
}

/** Adds an address to the beta list with one roll on it, or leaves an existing one alone. */
export async function grantAccessAction(input: { email: string }): Promise<ActionResult> {
  const over = await withinAdminBudget();
  if (over) return over;

  const parsed = grantAccessSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  if (await grantAccess(parsed.data.email)) await sendAccessGranted(parsed.data.email);
  revalidatePath("/admin");
  return { ok: true };
}

/** The − and + beside a counter. One roll per tap, floored at zero. */
export async function adjustAccessAction(input: {
  id: string;
  delta: 1 | -1;
}): Promise<ActionResult> {
  const over = await withinAdminBudget();
  if (over) return over;

  const parsed = adjustAccessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid" };

  const granted = await adjustAccess(parsed.data.id, parsed.data.delta);
  if (granted) await sendAccessGranted(granted);
  revalidatePath("/admin");
  return { ok: true };
}

/** Drops an address off the list. Rolls they already created are untouched. */
export async function revokeAccessAction(input: { id: string }): Promise<ActionResult> {
  const over = await withinAdminBudget();
  if (over) return over;

  const parsed = revokeAccessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid" };

  await revokeAccess(parsed.data.id);
  revalidatePath("/admin");
  return { ok: true };
}
