import { redirect } from "next/navigation";
import { cache } from "react";

import { readHostClaims } from "./auth";
import { prisma } from "./prisma";

/**
 * Cached per request so a page and its nested layouts don't each hit the database.
 *
 * The cookie is signed, but we still load the user to compare `tokenVersion` — that's what
 * makes changing a password actually invalidate sessions already out in the wild.
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
      role: true,
      accessStatus: true,
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
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

/** Hosts can only create events once we've let them into the beta. */
export function canCreateEvents(user: CurrentUser): boolean {
  return user.accessStatus === "APPROVED";
}
