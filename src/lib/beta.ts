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
 * always did — an account costs us nothing, a roll costs us storage. What has moved is where
 * it starts: the first roll is on the house, and the list is what the second one needs.
 */

export class BetaAccessError extends Error {}

/**
 * The roll every account gets without asking for one.
 *
 * Signing in is signing in with Google, so an account is already a real address belonging to
 * a real person — which is most of what the gate was ever buying us. What it cost was asking
 * somebody to fill in a form and wait for a human before they had seen the product do
 * anything at all. The second roll is where permission starts meaning something, because by
 * then they know what they are asking for.
 */
const FREE_ROLLS = 1;

/**
 * How many times an account may delete an unstarted roll and have the allowance back.
 *
 * The refund is there so fixing a typo by starting over is not a penalty. Uncapped it is also
 * a free roll on tap — create, delete before the start, repeat — which is exactly what the
 * free roll would hand to anybody who noticed. Once is a mistake; twice is somebody finding
 * out what the button does, and they can ask like everybody else.
 */
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
async function rollsLeftFor(user: Account): Promise<number | null> {
  if (unlimited(user)) return null;

  const access = await prisma.betaAccess.findUnique({
    where: { email: normalizeEmail(user.email) },
    select: { rollsLeft: true },
  });

  // No row at all is an account that has never spent a roll, which is who the free one is
  // for. Spending it writes the row, so this stands in for the allowance exactly once.
  return access?.rollsLeft ?? FREE_ROLLS;
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

  const email = normalizeEmail(user.email);

  /*
    The free roll is granted rather than special-cased, so one counter still answers every
    question and the decrement below is still the only thing that decides. `skipDuplicates` is
    what makes that true under a double submit: whichever request inserts the row, both then
    race for the same decrement and the database picks one. A row that already exists — spent,
    topped up, or typed in by an admin — is left exactly as it is.
  */
  await tx.betaAccess.createMany({
    data: [{ email, rollsLeft: FREE_ROLLS }],
    skipDuplicates: true,
  });

  const spent = await tx.betaAccess.updateMany({
    where: { email, rollsLeft: { gt: 0 } },
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
 *
 * `MAX_REFUNDS` in the WHERE rather than a check above it, for the same reason the decrement
 * puts its own condition there. A roll deleted after its start, after it closed, or by the
 * nightly sweep never reaches here at all: that one was spent on what it was for.
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
 * Adds an address, or puts one roll back on an address that has run out.
 *
 * Deliberately not "set to 1": re-typing an address that already has four rolls left should
 * not quietly take three of them away. Adjusting is what the counter is for.
 *
 * Returns whether somebody just got in — the only case worth emailing about.
 *
 * Not simply "is the address new". Every account that has spent its free roll leaves a row
 * behind sitting at zero, so an address already on the list is the ordinary case rather than
 * a slip, and skipping it would have meant an admin typing somebody in, seeing nothing
 * happen, and having to find the same row and press +. Zero is let back in; rolls to spare
 * are left alone, which is the part that was always deliberate.
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

/**
 * The + and − beside the counter. Floored at zero; there is no such thing as owing a roll.
 *
 * Returns the address when this took it off zero, so the caller can tell them they are in.
 * Topping up somebody who still has rolls left is not news to them.
 */
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
