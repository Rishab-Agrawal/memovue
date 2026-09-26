"use server";

import type { RevealMode } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  deleteRoll,
  deleteRollPhoto,
  removeGuest,
  setRollSize,
  setRollUploads,
  updateRollFields,
  updateRollFinish,
  updateRollReveal,
  updateRollStart,
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

/** One volume ceiling for every settings edit a host makes to their own rolls. */
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

  await updateRollFields(rollId, user.id, { everyoneCanSee });
  revalidatePath(`/rolls/${rollId}`);
  return { ok: true };
}

export async function setGiveawayAction(
  rollId: string,
  giveawayAllowed: boolean,
): Promise<ActionResult> {
  const user = await requireHost();
  const over = overWriteBudget(user.id);
  if (over) return over;

  await updateRollFields(rollId, user.id, { giveawayAllowed });
  revalidatePath(`/rolls/${rollId}`);
  return { ok: true };
}

export async function setUploadsAction(
  rollId: string,
  uploadsAllowed: boolean,
): Promise<ActionResult> {
  const user = await requireHost();
  const over = overWriteBudget(user.id);
  if (over) return over;

  await setRollUploads(rollId, user.id, uploadsAllowed);
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

  await updateRollFields(rollId, user.id, parsed.data);
  revalidatePath(`/rolls/${rollId}`);
  return { ok: true };
}

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

/** Removals delete bytes from the bucket, so they get their own, slower budget. */
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

/** A different reveal while sealed — including `DURING`, which opens it for good. */
export async function updateRevealAction(
  rollId: string,
  input: { revealMode: RevealMode; revealDelayHours: number },
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

  // Tightest budget here: it deletes a whole roll's bytes and can refund an allowance.
  if (!rateLimit(`delete-roll:${user.id}`, 10, 3_600).ok) redirect(`/rolls/${rollId}`);

  await deleteRoll(rollId, user.id);
  revalidatePath("/rolls");
  redirect("/rolls");
}
