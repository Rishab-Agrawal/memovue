"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  deleteRoll,
  revealRollNow,
  updateRollInfo,
  updateRollVisibility,
} from "@/lib/rolls";
import { rateLimit } from "@/lib/ratelimit";
import { requireHost } from "@/lib/session";
import { editRollSchema, fieldErrors } from "@/lib/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * One budget for every edit a host can make to their own rolls.
 *
 * Shared rather than per-action because they are one screen: a settings sheet of toggles and
 * fields, where sixty writes in a minute is already far more than a person tapping. Nothing
 * here is dangerous on its own — each one is a host changing their own roll — so this is a
 * ceiling on volume, not a gate.
 */
function overWriteBudget(userId: string): ActionResult | null {
  if (rateLimit(`roll-write:${userId}`, 60, 60).ok) return null;
  return { ok: false, error: "That's a lot of changes at once. Give it a moment." };
}

export async function setVisibilityAction(
  rollId: string,
  everyoneCanSee: boolean,
): Promise<ActionResult> {
  const user = await requireHost();
  const over = overWriteBudget(user.id);
  if (over) return over;

  await updateRollVisibility(rollId, user.id, everyoneCanSee);
  revalidatePath(`/rolls/${rollId}`);
  return { ok: true };
}

export async function updateInfoAction(
  rollId: string,
  input: { name: string; coverPreset: number },
): Promise<ActionResult> {
  const user = await requireHost();
  const over = overWriteBudget(user.id);
  if (over) return over;

  const parsed = editRollSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: Object.values(fieldErrors(parsed.error))[0] ?? "Invalid" };
  }

  await updateRollInfo(rollId, user.id, parsed.data);
  revalidatePath(`/rolls/${rollId}`);
  return { ok: true };
}

/** The escape hatch when a host wants the album open early. Cannot be undone. */
export async function revealNowAction(rollId: string): Promise<ActionResult> {
  const user = await requireHost();
  const over = overWriteBudget(user.id);
  if (over) return over;

  await revealRollNow(rollId, user.id);
  revalidatePath(`/rolls/${rollId}`);
  return { ok: true };
}

export async function deleteRollAction(rollId: string): Promise<never> {
  const user = await requireHost();

  /*
    Its own, far tighter budget: this is the one action here that walks a roll's photographs
    out of R2, and — for a roll that has not started — hands the allowance back, so the loop
    it would otherwise permit costs us storage operations and costs the caller nothing.
  */
  if (!rateLimit(`delete-roll:${user.id}`, 10, 3_600).ok) redirect(`/rolls/${rollId}`);

  await deleteRoll(rollId, user.id);
  revalidatePath("/rolls");
  redirect("/rolls");
}
