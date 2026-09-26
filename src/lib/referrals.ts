import "server-only";

import type { CodeKind, Prisma } from "@prisma/client";

import { normalizeCode } from "./codes";
import { prisma } from "./prisma";
import { deleteObjects, publicUrl, putObject, referrerLogoKey, storageConfigured } from "./storage";

/**
 * Referral codes: the gate every roll goes through, and the wedding businesses that send hosts
 * here.
 *
 * A code is resolved in exactly two places — the Create dialog, which checks one before sending
 * somebody off to sign in, and roll creation, which is the trust boundary and spends it. The
 * card on a roll reads the roll's `referrerId`, which only a business code sets.
 *
 * Codes are normalised the way a roll code is, so "bloom-events" and "BLOOM EVENTS" are the
 * same code however it was written on whatever the business handed the host.
 */

/** What the card on the roll screen draws. */
export interface Sponsor {
  name: string;
  url: string | null;
  logoUrl: string | null;
}

const card = { name: true, url: true, logoUrl: true } as const;

/**
 * The code on the one row that is not a real business: the made-up card on the sample album
 * an admin screenshots for the businesses they are pitching to. It is held here rather than in
 * a table of its own because it is exactly a `Referrer` minus the code and the address, and a
 * second table for one row would drift from the card it is pretending to be.
 *
 * Nothing outside `sampleSponsor` may resolve it, or the pitch deck's fake florist would start
 * turning up on real weddings.
 */
export const SAMPLE_CODE = "SAMPLE";

export function isReservedCode(input: string): boolean {
  return normalizeCode(input) === SAMPLE_CODE;
}

/** The code a host typed, or null for anything that is not one. */
export async function findReferrer(input: string) {
  const code = normalizeCode(input);
  if (!code || code === SAMPLE_CODE) return null;

  // `email` is here and not in `card`: it is the one field that must never reach a browser.
  return prisma.referrer.findUnique({
    where: { code },
    select: { id: true, code: true, kind: true, used: true, maxUses: true, email: true, ...card },
  });
}

export function isSpent(referrer: { used: number; maxUses: number }): boolean {
  return referrer.used >= referrer.maxUses;
}

export class CodeSpentError extends Error {}

/**
 * Spends one use, atomically: the ceiling is in the WHERE, so two rolls cannot share the last
 * one. Called inside the transaction that inserts the roll.
 */
export async function spendCode(tx: Pick<typeof prisma, "referrer">, id: string): Promise<void> {
  const { count } = await tx.referrer.updateMany({
    where: { id, used: { lt: prisma.referrer.fields.maxUses } },
    data: { used: { increment: 1 } },
  });
  if (count === 0) throw new CodeSpentError();
}

/** A business's card. Only a business has one, and a business always has a name. */
async function cardWhere(where: Prisma.ReferrerWhereUniqueInput): Promise<Sponsor | null> {
  const row = await prisma.referrer.findUnique({ where, select: card });
  return row?.name ? { ...row, name: row.name } : null;
}

/**
 * The business to credit on one roll's home screen. Null costs no query, so a roll created
 * with an individual's code pays nothing for this.
 */
export async function sponsorFor(roll: { referrerId: string | null }): Promise<Sponsor | null> {
  if (!roll.referrerId) return null;
  return cardWhere({ id: roll.referrerId });
}

/* ------------------------------------------------------------------ admin */

/** Every code, newest first. */
export function listReferrers() {
  return prisma.referrer.findMany({
    where: { code: { not: SAMPLE_CODE } },
    orderBy: { createdAt: "desc" },
    select: { ...card, id: true, code: true, kind: true, maxUses: true, used: true, email: true },
  });
}

/** Who used which code, for which roll, newest first. */
export function listRedemptions() {
  return prisma.redemption.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      rollName: true,
      createdAt: true,
      user: { select: { email: true } },
      referrer: { select: { code: true, kind: true, name: true, email: true } },
    },
  });
}

/** Whether a logo URL is one we are hosting, rather than one somebody typed. */
function ours(id: string, logoUrl: string | null): boolean {
  return (
    storageConfigured && logoUrl !== null && logoUrl.startsWith(publicUrl(referrerLogoKey(id)))
  );
}

export type SaveResult = "ok" | "code-taken" | "not-found";

/**
 * Creates a code, or edits one — every field, including the code itself. One path for both,
 * because an admin who mistypes a business name on Tuesday should not need a different screen
 * on Wednesday, and two paths would drift.
 *
 * `logo` is raw JPEG bytes the browser already resized. It replaces whatever the logo was;
 * a `logoUrl` that is not ours means the business now points somewhere else, so our copy goes
 * rather than sitting in the bucket forever.
 */
export async function saveReferrer(input: {
  /** Absent creates. */
  id?: string;
  code: string;
  kind: CodeKind;
  maxUses: number;
  name: string | null;
  url: string | null;
  email: string | null;
  logoUrl: string | null;
  logo: Uint8Array | null;
}): Promise<SaveResult> {
  const code = normalizeCode(input.code);

  // Checked rather than caught, so "already taken" is told apart from any other write failure.
  const clash = await prisma.referrer.findUnique({ where: { code }, select: { id: true } });
  if (clash && clash.id !== input.id) return "code-taken";

  const fields = {
    code,
    kind: input.kind,
    maxUses: input.maxUses,
    name: input.name,
    url: input.url,
    email: input.email,
    logoUrl: input.logoUrl,
  };

  let id: string;
  if (input.id) {
    const updated = await prisma.referrer.updateMany({ where: { id: input.id }, data: fields });
    if (updated.count === 0) return "not-found";
    id = input.id;
  } else {
    ({ id } = await prisma.referrer.create({ data: fields, select: { id: true } }));
  }

  if (input.logo && storageConfigured) {
    const key = referrerLogoKey(id);
    await putObject(key, input.logo, "image/jpeg");
    // Overwritten in place, so the URL carries the clock that gets it past the CDN.
    await prisma.referrer.update({
      where: { id },
      data: { logoUrl: `${publicUrl(key)}?v=${Date.now()}` },
    });
  } else if (input.id && !ours(id, input.logoUrl)) {
    // Pointed elsewhere, or cleared. Either way the copy we were hosting has no reader left.
    await deleteObjects([referrerLogoKey(id)]).catch(() => {});
  }

  return "ok";
}

/**
 * Retires a code, and its lines in the log with it. Rolls that used it keep their row and lose
 * the credit — `onDelete: SetNull`, because a roll outliving the business that sold it is not a
 * reason to delete somebody's album.
 */
export async function removeReferrer(id: string) {
  await deleteObjects([referrerLogoKey(id)]).catch(() => {});
  await prisma.referrer.deleteMany({ where: { id } });
}

/* ------------------------------------------------------------------ the sample card */

/** The made-up business on the sample album, or null before one has been written. */
export function sampleSponsor(): Promise<Sponsor | null> {
  return cardWhere({ code: SAMPLE_CODE });
}

/** The same write as any other card, on the row nobody can reach with a code. */
export async function saveSampleSponsor(input: {
  name: string;
  url: string | null;
  logoUrl: string | null;
  logo: Uint8Array | null;
}): Promise<SaveResult> {
  const existing = await prisma.referrer.findUnique({
    where: { code: SAMPLE_CODE },
    select: { id: true },
  });

  return saveReferrer({
    ...input,
    id: existing?.id,
    code: SAMPLE_CODE,
    kind: "BUSINESS",
    maxUses: 0,
    email: null,
  });
}

/* ------------------------------------------------------------------ the digest */

/** Businesses whose codes created a roll in the given window. What the digest names. */
export async function referredSince(from: Date, to: Date) {
  const businesses = await prisma.referrer.findMany({
    select: {
      name: true,
      _count: { select: { rolls: { where: { createdAt: { gte: from, lt: to } } } } },
    },
  });

  return businesses
    .filter((business) => business._count.rolls > 0)
    .sort((a, b) => b._count.rolls - a._count.rolls)
    .map((business) => ({ name: business.name, rolls: business._count.rolls }));
}

/* ------------------------------------------------------------------ asking for a code */

export function listRequests() {
  return prisma.codeRequest.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}

export function recordRequest(email: string) {
  return prisma.codeRequest.create({ data: { email: email.toLowerCase() } });
}
