import "server-only";

import type { Role } from "@prisma/client";

import { prisma } from "./prisma";

/**
 * Who may create a roll while MemoVue is invite-only. The gate is on rolls, not accounts: an
 * account costs nothing, a roll costs storage. The first roll is free; more need the list.
 */

export class BetaAccessError extends Error {}

/** What an account may create before anybody has to let them in. */
const FREE_ROLLS = 1;

/** Give-backs per account. Uncapped, create-and-delete-before-the-start is a free roll on tap. */
const MAX_REFUNDS = 1;

/** What every refusal says. Shown in the dialog that offers the request form. */
const NO_ACCESS =
  "You've used the roll your account comes with. MemoVue is invite-only while we're in " +
  "beta, so the next one needs us to let you in.";

/** Only ever compared against a lower-cased `BetaAccess.email`. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** The three fields every check here needs. Satisfied by `CurrentUser`. */
export interface Account {
  id: string;
  email: string;
  role: Role;
}

/** The admin is not on their own list. `ADMIN` comes from `ADMIN_EMAIL`, not self-service. */
function unlimited(user: Account): boolean {
  return user.role === "ADMIN";
}

/** How many rolls are left to this account, or null when it is not limited at all. */
async function rollsLeftFor(user: Account): Promise<number | null> {
  if (unlimited(user)) return null;

  const access = await prisma.betaAccess.findUnique({
    where: { email: normalizeEmail(user.email) },
    select: { rollsLeft: true },
  });

  // No row is an account that has never spent a roll. Spending one writes the row.
  return access?.rollsLeft ?? FREE_ROLLS;
}

export async function canCreateRoll(user: Account): Promise<boolean> {
  const left = await rollsLeftFor(user);
  return left === null || left > 0;
}

/**
 * Spends one roll, atomically: `rollsLeft > 0` is in the WHERE so two concurrent requests
 * cannot both spend one allowance. Called inside the transaction that inserts the roll.
 */
export async function spendRoll(
  tx: Pick<typeof prisma, "betaAccess">,
  user: Account,
): Promise<void> {
  if (unlimited(user)) return;

  const email = normalizeEmail(user.email);

  // The free roll is granted as a row, so the decrement below stays the only decision.
  await tx.betaAccess.createMany({
    data: [{ email, rollsLeft: FREE_ROLLS }],
    skipDuplicates: true,
  });

  const spent = await tx.betaAccess.updateMany({
    where: { email, rollsLeft: { gt: 0 } },
    data: { rollsLeft: { decrement: 1 } },
  });

  if (spent.count === 0) throw new BetaAccessError(NO_ACCESS);
}

/**
 * Gives one back, for a roll deleted before its event began. `updateMany` so an account with no
 * row is a no-op rather than a throw.
 */
export async function refundRoll(user: Account): Promise<void> {
  if (unlimited(user)) return;

  await prisma.betaAccess.updateMany({
    where: { email: normalizeEmail(user.email), refunds: { lt: MAX_REFUNDS } },
    data: { rollsLeft: { increment: 1 }, refunds: { increment: 1 } },
  });
}

/* ------------------------------------------------------------------ admin */

export function listAccess() {
  return prisma.betaAccess.findMany({ orderBy: { createdAt: "desc" } });
}

/**
 * Adds an address, or puts one roll back on an address at zero — never resets a higher count.
 * Returns whether somebody just got in, the only case worth emailing about.
 */
export async function grantAccess(email: string): Promise<boolean> {
  const address = normalizeEmail(email);

  const { count } = await prisma.betaAccess.createMany({
    data: [{ email: address }],
    skipDuplicates: true,
  });
  if (count > 0) return true;

  const topped = await prisma.betaAccess.updateMany({
    where: { email: address, rollsLeft: 0 },
    data: { rollsLeft: 1 },
  });
  return topped.count > 0;
}

/** The + and − beside the counter, floored at zero. Returns the address when it left zero. */
export async function adjustAccess(id: string, delta: number): Promise<string | null> {
  const row = await prisma.betaAccess.findUnique({
    where: { id },
    select: { email: true, rollsLeft: true },
  });
  if (!row) return null;

  const rollsLeft = Math.max(0, row.rollsLeft + delta);
  await prisma.betaAccess.update({ where: { id }, data: { rollsLeft } });
  return row.rollsLeft === 0 && rollsLeft > 0 ? row.email : null;
}

/** Takes an address off the list. `deleteMany` so a stale id is a no-op. */
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
