"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  deleteRoll,
  revealRollNow,
  updateRollInfo,
  updateRollSchedule,
  updateRollVisibility,
} from "@/lib/rolls";
import { requireHost } from "@/lib/session";
import { editRollSchema, fieldErrors, rollScheduleSchema } from "@/lib/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setVisibilityAction(
  rollId: string,
  everyoneCanSee: boolean,
): Promise<ActionResult> {
  const user = await requireHost();
  await updateRollVisibility(rollId, user.id, everyoneCanSee);
  revalidatePath(`/rolls/${rollId}`);
  return { ok: true };
}

export async function updateInfoAction(
  rollId: string,
  input: { name: string; coverPreset: number },
): Promise<ActionResult> {
  const user = await requireHost();

  const parsed = editRollSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: Object.values(fieldErrors(parsed.error))[0] ?? "Invalid" };
  }

  await updateRollInfo(rollId, user.id, parsed.data);
  revalidatePath(`/rolls/${rollId}`);
  return { ok: true };
}

export async function updateScheduleAction(
  rollId: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const user = await requireHost();

  const parsed = rollScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: Object.values(fieldErrors(parsed.error))[0] ?? "Invalid" };
  }

  const data = parsed.data;
  await updateRollSchedule(rollId, user.id, {
    startsAt: new Date(data.startsAt),
    finishesAt: new Date(data.finishesAt),
    revealMode: data.revealMode,
    revealDelayHours: data.revealDelayHours,
  });

  revalidatePath(`/rolls/${rollId}`);
  return { ok: true };
}

/** The escape hatch when a host wants the album open early. Cannot be undone. */
export async function revealNowAction(rollId: string): Promise<ActionResult> {
  const user = await requireHost();
  await revealRollNow(rollId, user.id);
  revalidatePath(`/rolls/${rollId}`);
  return { ok: true };
}

export async function deleteRollAction(rollId: string): Promise<never> {
  const user = await requireHost();
  await deleteRoll(rollId, user.id);
  revalidatePath("/rolls");
  redirect("/rolls");
}
