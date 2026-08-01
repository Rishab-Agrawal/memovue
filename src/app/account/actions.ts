"use server";

import { redirect } from "next/navigation";

import { clearHostSession, createHostSession, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireHost } from "@/lib/session";
import { deleteObjects } from "@/lib/storage";
import { changePasswordSchema, fieldErrors } from "@/lib/validation";

export interface AccountState {
  error?: string;
  success?: string;
  fields?: Record<string, string>;
}

export async function changePasswordAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireHost();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record) return { error: "Something went wrong. Please sign in again." };

  const ok = await verifyPassword(parsed.data.currentPassword, record.passwordHash);
  if (!ok) return { fields: { currentPassword: "That's not your current password." } };

  // Bumping tokenVersion invalidates every session — including any the user didn't
  // recognise, which is the whole point of changing a password.
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
      tokenVersion: { increment: 1 },
    },
  });

  await createHostSession(updated);
  return { success: "Password changed. Any other devices have been signed out." };
}

/**
 * Full erasure: the account, every event on it, every guest record, and every image object
 * in R2. Nothing is soft-deleted, because "delete my data" should mean exactly that.
 */
export async function deleteAccountAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireHost();

  const password = String(formData.get("password") ?? "");
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record) return { error: "Something went wrong. Please sign in again." };

  if (!(await verifyPassword(password, record.passwordHash))) {
    return { fields: { password: "That password isn't right." } };
  }

  const photos = await prisma.photo.findMany({
    where: { event: { hostId: user.id } },
    select: { fullKey: true, previewKey: true },
  });

  await deleteObjects(photos.flatMap((photo) => [photo.fullKey, photo.previewKey]));
  // Events, guests and photo rows all cascade from the user.
  await prisma.user.delete({ where: { id: user.id } });
  await clearHostSession();

  redirect("/?deleted=1");
}
