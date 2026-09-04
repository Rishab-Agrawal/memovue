import "server-only";

import type { Role } from "@prisma/client";

import { prisma } from "./prisma";

/**
 * Who is allowed to create a roll while MemoVue is invite-only.
 *
 * This replaced single-use coupon codes. A code had to be minted, copied out of an admin
 * screen, and handed to somebody over a channel we do not own — and if they lost it, or spent
 * it on a roll they immediately deleted, there was no way to give it back. An allowance on an
 * email address needs no handover at all: the person signs in with Google, and the address
 * they arrive with is the one already on the list.
 *
 * The gate stays on creating a roll rather than on holding an account, for the same reason it
 * always did — an account costs us nothing, a roll costs us storage.
 */

export class BetaAccessError extends Error {}

/** What every refusal says. Shown in the dialog that offers the request form. */
export const NO_ACCESS =
  "MemoVue is invite-only while we're in beta, and this account isn't on the list yet.";

/** Only ever compared against a lower-cased `BetaAccess.email`. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** The three fields every check here needs. Satisfied by `CurrentUser`. */
export interface Account {
  id: string;
  email: string;
  role: Role;
}

/**
 * The owner is not on their own list.
 *
 * An allowance row for the admin would be one more thing to remember to top up, and the
 * account that hands out access refusing to create a roll at 2am is a support ticket from
 * yourself. `ADMIN` is set from `ADMIN_EMAIL` at sign-in, so this is not self-service.
 */
function unlimited(user: Account): boolean {
  return user.role === "ADMIN";
}

/** How many rolls are left to this account, or null when it is not limited at all. */
export async function rollsLeftFor(user: Account): Promise<number | null> {
  if (unlimited(user)) return null;

  const access = await prisma.betaAccess.findUnique({
    where: { email: normalizeEmail(user.email) },
    select: { rollsLeft: true },
  });

  return access?.rollsLeft ?? 0;
}

export async function canCreateRoll(user: Account): Promise<boolean> {
  const left = await rollsLeftFor(user);
  return left === null || left > 0;
}

/**
 * Spends one roll from the allowance, atomically.
 *
 * `rollsLeft: { gt: 0 }` sits in the WHERE rather than in a check above it, and that is the
 * whole point: reading the row, deciding it looks positive, and then writing would let two
 * requests a millisecond apart both pass and both create a roll on one allowance. The
 * database decides.
 *
 * Called inside the same transaction that inserts the roll, so an allowance cannot be spent
 * without a roll to show for it.
 */
export async function spendRoll(
  tx: Pick<typeof prisma, "betaAccess">,
  user: Account,
): Promise<void> {
  if (unlimited(user)) return;

  const spent = await tx.betaAccess.updateMany({
    where: { email: normalizeEmail(user.email), rollsLeft: { gt: 0 } },
    data: { rollsLeft: { decrement: 1 } },
  });

  // One message for "never added" and "ran out". Both mean the same thing to the person
  // holding the phone, and both end at the same request form.
  if (spent.count === 0) throw new BetaAccessError(NO_ACCESS);
}

/**
 * Gives one back, for a roll deleted before its event began.
 *
 * Nothing was shot on it, so nothing was stored and it cost us nothing; making somebody ask
 * for access again because they fixed a typo by starting over is a penalty for no reason.
 * `updateMany` rather than `update` so an account with no allowance row — the admin, or
 * somebody whose access was withdrawn since — is a no-op instead of a throw.
 */
export async function refundRoll(user: Account): Promise<void> {
  if (unlimited(user)) return;

  await prisma.betaAccess.updateMany({
    where: { email: normalizeEmail(user.email) },
    data: { rollsLeft: { increment: 1 } },
  });
}

/* ------------------------------------------------------------------ admin */

export function listAccess() {
  return prisma.betaAccess.findMany({ orderBy: { createdAt: "desc" } });
}

/**
 * Adds an address, or leaves an existing one alone.
 *
 * Deliberately not "set to 1": re-typing an address that already has four rolls left should
 * not quietly take three of them away. Adjusting is what the counter is for.
 */
export function grantAccess(email: string) {
  const normalized = normalizeEmail(email);
  return prisma.betaAccess.upsert({
    where: { email: normalized },
    create: { email: normalized },
    update: {},
  });
}

/** The + and − beside the counter. Floored at zero; there is no such thing as owing a roll. */
export async function adjustAccess(id: string, delta: number): Promise<void> {
  const row = await prisma.betaAccess.findUnique({ where: { id }, select: { rollsLeft: true } });
  if (!row) return;

  await prisma.betaAccess.update({
    where: { id },
    data: { rollsLeft: Math.max(0, row.rollsLeft + delta) },
  });
}

/**
 * Takes an address off the list entirely.
 *
 * `deleteMany` rather than `delete` so a stale id — a second tap, or a row another tab
 * already removed — is a no-op instead of a throw on a screen with nothing to do about it.
 *
 * Removing is not the same as setting the counter to zero, though both refuse the person the
 * same way. Zero is somebody we have let in who has used what they were given; gone is
 * somebody we would rather not keep a record of at all.
 */
export function revokeAccess(id: string) {
  return prisma.betaAccess.deleteMany({ where: { id } });
}

export function listRequests() {
  return prisma.betaRequest.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}

export function recordRequest(request: {
  email: string;
  name: string;
  phone?: string;
  eventType: string;
  remarks?: string;
}) {
  return prisma.betaRequest.create({
    data: {
      email: normalizeEmail(request.email),
      name: request.name,
      phone: request.phone || null,
      eventType: request.eventType,
      remarks: request.remarks || null,
    },
  });
}
