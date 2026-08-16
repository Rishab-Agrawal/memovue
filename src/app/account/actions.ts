"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearHostSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireHost } from "@/lib/session";
import { fieldErrors, updateNameSchema } from "@/lib/validation";

export async function updateNameAction(
  input: { name: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireHost();

  const parsed = updateNameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: Object.values(fieldErrors(parsed.error))[0] ?? "Invalid" };
  }

  await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
  revalidatePath("/account");
  return { ok: true };
}

export async function logoutAction(): Promise<never> {
  await clearHostSession();
  redirect("/welcome");
}

/**
 * Deleting the account cascades to rolls, guests and photo rows.
 *
 * The image files in R2 are not removed here — that is a bulk operation that does not belong
 * in a request, and orphaned objects are cheap and harmless until the retention job sweeps
 * them. What matters is that nothing is reachable any more.
 */
export async function deleteAccountAction(): Promise<never> {
  const user = await requireHost();
  await prisma.user.delete({ where: { id: user.id } });
  await clearHostSession();
  redirect("/");
}
