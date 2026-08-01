"use server";

import { revalidatePath } from "next/cache";

import { inviteCode, normalizeCode } from "@/lib/codes";
import { sendAccessApproved, sendAccessDenied } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { fieldErrors, inviteCodeSchema } from "@/lib/validation";

export interface AdminState {
  error?: string;
  fields?: Record<string, string>;
  createdCode?: string;
}

export async function decideAccessAction(userId: string, approve: boolean): Promise<AdminState> {
  await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) return { error: "That account no longer exists." };

  const status = approve ? "APPROVED" : "DENIED";

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { accessStatus: status } }),
    prisma.accessRequest.updateMany({
      where: { userId },
      data: { status, decidedAt: new Date() },
    }),
  ]);

  if (approve) await sendAccessApproved(user.email, user.name);
  else await sendAccessDenied(user.email, user.name);

  revalidatePath("/admin");
  return {};
}

export async function createInviteCodeAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const parsed = inviteCodeSchema.safeParse({
    note: String(formData.get("note") ?? "").trim() || undefined,
    maxUses: Number(formData.get("maxUses") ?? 1),
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const created = await prisma.inviteCode.create({
    data: {
      code: normalizeCode(inviteCode()),
      note: parsed.data.note ?? null,
      maxUses: parsed.data.maxUses,
    },
  });

  revalidatePath("/admin");
  return { createdCode: created.code };
}

export async function deleteInviteCodeAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.inviteCode.delete({ where: { id } });
  revalidatePath("/admin");
}
