"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  deleteRoll,
  deleteRollPhoto,
  removeGuest,
  setRollSize,
  updateRollFinish,
  updateRollInfo,
  updateRollReveal,
  updateRollStart,
  updateRollVisibility,
} from "@/lib/rolls";
import { rateLimit } from "@/lib/ratelimit";
import { requireHost } from "@/lib/session";
import {
  type ActionResult,
  editFinishSchema,
  editRevealSchema,
  editRollSchema,
  editSizeSchema,
  editStartSchema,
  firstError,
} from "@/lib/validation";

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
    return { ok: false, error: firstError(parsed.error) };
  }

  await updateRollInfo(rollId, user.id, parsed.data);
  revalidatePath(`/rolls/${rollId}`);
  return { ok: true };
}

/** A later — or earlier — closing time, for a party that did not run to schedule. */
export async function updateFinishAction(
  rollId: string,
  finishesAt: string,
): Promise<ActionResult> {
  const user = await requireHost();
  const over = overWriteBudget(user.id);
  if (over) return over;

  const parsed = editFinishSchema.safeParse({ finishesAt });
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const moved = await updateRollFinish(rollId, user.id, new Date(parsed.data.finishesAt));
  if (!moved) return { ok: false, error: "This roll has already opened." };

  revalidatePath(`/rolls/${rollId}`);
  return { ok: true };
}

/** A different opening time, for a roll whose event has not begun. */
export async function updateStartAction(rollId: string, startsAt: string): Promise<ActionResult> {
  const user = await requireHost();
  const over = overWriteBudget(user.id);
  if (over) return over;

  const parsed = editStartSchema.safeParse({ startsAt });
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const moved = await updateRollStart(rollId, user.id, new Date(parsed.data.startsAt));
  if (!moved) return { ok: false, error: "This roll has already started." };

  revalidatePath(`/rolls/${rollId}`);
  return { ok: true };
}

/**
 * More guests, or more film each — for a roll that filled up while people were still arriving,
 * or ran out of shots halfway through the evening.
 */
export async function setSizeAction(
  rollId: string,
  next: { maxGuests?: number; photosPerGuest?: number },
): Promise<ActionResult> {
  const user = await requireHost();
  const over = overWriteBudget(user.id);
  if (over) return over;

  const parsed = editSizeSchema.safeParse(next);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const result = await setRollSize(rollId, user.id, parsed.data);
  if (result === "not-found") return { ok: false, error: "This roll is no longer there." };
  if (result === "below-joined") {
    return { ok: false, error: "More people than that have already joined this roll." };
  }

  revalidatePath(`/rolls/${rollId}`);
  return { ok: true };
}

/**
 * Removing one photograph, and removing the person who took it.
 *
 * Both walk bytes out of the bucket, so they share the delete budget rather than the writing
 * one — a host clearing up after an event does a handful of these, and nothing legitimate
 * does hundreds.
 */
function overDeleteBudget(userId: string): ActionResult | null {
  if (rateLimit(`roll-remove:${userId}`, 60, 3_600).ok) return null;
  return { ok: false, error: "That's a lot of removals at once. Give it a moment." };
}

export async function deletePhotoAction(rollId: string, photoId: string): Promise<ActionResult> {
  const user = await requireHost();
  const over = overDeleteBudget(user.id);
  if (over) return over;

  const removed = await deleteRollPhoto(rollId, user.id, photoId);
  if (!removed) return { ok: false, error: "That photograph is no longer there." };

  revalidatePath(`/rolls/${rollId}`);
  return { ok: true };
}

export async function removeGuestAction(rollId: string, guestId: string): Promise<ActionResult> {
  const user = await requireHost();
  const over = overDeleteBudget(user.id);
  if (over) return over;

  const removed = await removeGuest(rollId, user.id, guestId);
  if (!removed) return { ok: false, error: "That guest is no longer in this roll." };

  revalidatePath(`/rolls/${rollId}`);
  return { ok: true };
}

/**
 * A different reveal, while the roll is still sealed — including `DURING`, which opens it on
 * the spot and cannot be undone.
 */
export async function updateRevealAction(
  rollId: string,
  input: { revealMode: "DURING" | "AFTER" | "DELAY"; revealDelayHours: number },
): Promise<ActionResult> {
  const user = await requireHost();
  const over = overWriteBudget(user.id);
  if (over) return over;

  const parsed = editRevealSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const moved = await updateRollReveal(
    rollId,
    user.id,
    parsed.data.revealMode,
    parsed.data.revealDelayHours,
  );
  if (!moved) return { ok: false, error: "This roll has already opened." };

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
