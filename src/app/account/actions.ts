"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearHostSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { purgeRollsOfHost } from "@/lib/retention";
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
 * Deleting the account takes the rolls, the photo rows, and the image files with it.
 *
 * The bytes used to be left behind on the argument that they were harmless until a retention
 * job swept them. They were not sweepable: cascading the roll rows away first destroys the
 * only record of what those objects were called, so nothing could ever have found them again.
 * They go before the user row now, in that order, for the same reason the sweep does it that
 * way — a failure halfway leaves the account intact and retryable rather than the storage
 * stranded.
 */
export async function deleteAccountAction(): Promise<never> {
  const user = await requireHost();
  await purgeRollsOfHost(user.id);
  await prisma.user.delete({ where: { id: user.id } });
  await clearHostSession();
  redirect("/");
}
