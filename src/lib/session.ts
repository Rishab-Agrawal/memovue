import { redirect } from "next/navigation";
import { cache } from "react";

import { readHostClaims } from "./auth";
import { prisma } from "./prisma";

/**
 * Cached per request so a page and its nested layouts don't each hit the database.
 *
 * The cookie is signed, but we still load the user to compare `tokenVersion` — that's what
 * makes "sign out everywhere" actually invalidate sessions already out in the wild.
 */
export const getCurrentUser = cache(async () => {
  const claims = await readHostClaims();
  if (!claims) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      role: true,
      tokenVersion: true,
      createdAt: true,
    },
  });

  if (!user || user.tokenVersion !== claims.tokenVersion) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireHost(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");
  if (user.role !== "ADMIN") redirect("/rolls");
  return user;
}

/*
 * There is deliberately no `canCreateHosts`/`canCreateRolls` check here any more.
 *
 * Access used to be a property of the account: you asked for beta access, an admin approved
 * you, and `accessStatus` gated everything. With Google sign-in anyone can hold an account,
 * so the gate moved to the act that actually costs us something — creating a roll, which
 * spends a single-use coupon. See `redeemCoupon`.
 */
