"use server";

import { revalidatePath } from "next/cache";

import { adjustAccess, grantAccess, revokeAccess } from "@/lib/beta";
import { requireAdmin } from "@/lib/session";
import {
  adjustAccessSchema,
  fieldErrors,
  grantAccessSchema,
  revokeAccessSchema,
} from "@/lib/validation";

export type AdminResult = { ok: true } | { ok: false; error: string };

/** Adds an address to the beta list with one roll on it, or leaves an existing one alone. */
export async function grantAccessAction(input: { email: string }): Promise<AdminResult> {
  await requireAdmin();

  const parsed = grantAccessSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: Object.values(fieldErrors(parsed.error))[0] ?? "Invalid" };
  }

  await grantAccess(parsed.data.email);
  revalidatePath("/admin");
  return { ok: true };
}

/** The − and + beside a counter. One roll per tap, floored at zero. */
export async function adjustAccessAction(input: {
  id: string;
  delta: 1 | -1;
}): Promise<AdminResult> {
  await requireAdmin();

  const parsed = adjustAccessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid" };

  await adjustAccess(parsed.data.id, parsed.data.delta);
  revalidatePath("/admin");
  return { ok: true };
}

/** Drops an address off the list. Rolls they already created are untouched. */
export async function revokeAccessAction(input: { id: string }): Promise<AdminResult> {
  await requireAdmin();

  const parsed = revokeAccessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid" };

  await revokeAccess(parsed.data.id);
  revalidatePath("/admin");
  return { ok: true };
}
