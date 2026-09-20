"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearHostSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { purgeRollsOfHost } from "@/lib/retention";
import { requireHost } from "@/lib/session";
import { type ActionResult, firstError, updateNameSchema } from "@/lib/validation";

export async function updateNameAction(input: { name: string }): Promise<ActionResult> {
  const user = await requireHost();

  if (!rateLimit(`rename:${user.id}`, 20, 60).ok) {
    return { ok: false, error: "That's a lot of edits. Give it a moment." };
  }

  const parsed = updateNameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
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
 * The bytes go first, before the user row. Cascading the roll rows away destroys the only
 * record of what those objects were called, so anything left in storage is unfindable — no
 * retention job can sweep what nothing names. In this order a failure halfway leaves the
 * account intact and retryable instead, which is why the sweep does it the same way.
 */
export async function deleteAccountAction(): Promise<never> {
  const user = await requireHost();

  /*
    Not a defence against somebody deleting their own account — that is what the button is
    for, and after the first one succeeds there is no session left to call it with. It bounds
    the *overlap*: twenty of these fired at once all pass the check above and all start
    walking the same objects out of R2, which is a bill for work that only had to happen once.
    A screen coming back unchanged is the right answer to the second tap.
  */
  if (!rateLimit(`delete-account:${user.id}`, 3, 3_600).ok) redirect("/account");

  await purgeRollsOfHost(user.id);
  await prisma.user.delete({ where: { id: user.id } });
  await clearHostSession();
  redirect("/");
}
