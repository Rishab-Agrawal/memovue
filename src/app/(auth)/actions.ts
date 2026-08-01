"use server";

import { redirect } from "next/navigation";

import { clearHostSession, createHostSession, hashPassword, verifyPassword } from "@/lib/auth";
import { env } from "@/lib/env";
import { normalizeCode } from "@/lib/codes";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { fieldErrors, loginSchema, signupSchema } from "@/lib/validation";

export interface AuthFormState {
  error?: string;
  fields?: Record<string, string>;
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const limit = rateLimit(`login:${parsed.data.email}`, 8, 300);
  if (!limit.ok) {
    return { error: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.` };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Same message either way — don't leak which emails have accounts.
  const invalid = { error: "That email and password don't match." };
  if (!user) return invalid;

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return invalid;

  await createHostSession(user);
  redirect("/dashboard");
}

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const rawInvite = String(formData.get("inviteCode") ?? "").trim();

  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    inviteCode: rawInvite || undefined,
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { fields: { email: "An account with this email already exists." } };
  }

  // The owner's own email becomes admin on first signup, so nobody has to hand-edit the
  // database to get into the approvals queue.
  const isOwner = env.adminEmail !== "" && email === env.adminEmail;

  // An invite code is the fast path into the beta: we hand these out directly to hosts
  // we've already spoken to, so they never sit in a queue.
  let invite = null;
  if (rawInvite) {
    const code = normalizeCode(rawInvite);
    invite = await prisma.inviteCode.findUnique({ where: { code } });
    const usable =
      invite && invite.uses < invite.maxUses && (!invite.expiresAt || invite.expiresAt > new Date());
    if (!usable) {
      return { fields: { inviteCode: "That invite code isn't valid any more." } };
    }
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        role: isOwner ? "ADMIN" : "HOST",
        accessStatus: isOwner || invite ? "APPROVED" : "NONE",
      },
    });
    if (invite) {
      await tx.inviteCode.update({
        where: { id: invite.id },
        data: { uses: { increment: 1 } },
      });
    }
    return created;
  });

  await createHostSession(user);
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearHostSession();
  redirect("/");
}
