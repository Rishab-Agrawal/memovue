import "server-only";

import { normalizeCode } from "./codes";
import { REFERRALS } from "./constants";
import { prisma } from "./prisma";
import { deleteObjects, publicUrl, putObject, referrerLogoKey, storageConfigured } from "./storage";

/**
 * Wedding businesses that send hosts here.
 *
 * A code is resolved in exactly two places — the wizard's first step, which refuses one that
 * does not exist, and roll creation, which is the trust boundary and asks again. Everything
 * else reads the roll's `referrerId`.
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

/** The business behind a typed code, or null for anything that is not one. */
export async function findReferrer(input: string) {
  const code = normalizeCode(input);
  if (!code) return null;

  // `email` is here and not in `card`: it is the one field that must never reach a browser.
  return prisma.referrer.findUnique({
    where: { code },
    select: { id: true, email: true, ...card },
  });
}

/**
 * The business to credit on one roll's home screen. Null costs no query, so a roll created
 * without a code — which is most of them — pays nothing for this.
 */
export async function sponsorFor(roll: { referrerId: string | null }): Promise<Sponsor | null> {
  if (!REFERRALS || !roll.referrerId) return null;
  return prisma.referrer.findUnique({ where: { id: roll.referrerId }, select: card });
}

/* ------------------------------------------------------------------ admin */

/** The list, newest first, each with how many rolls its code has created. */
export function listReferrers() {
  return prisma.referrer.findMany({
    orderBy: { createdAt: "desc" },
    select: { ...card, id: true, code: true, email: true, _count: { select: { rolls: true } } },
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
 * Creates a business, or edits one — every field, including the code itself. One path for both,
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
  name: string;
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
 * Retires a code. Rolls that used it keep their row and lose the credit — `onDelete: SetNull`,
 * because a roll outliving the business that sold it is not a reason to delete somebody's album.
 */
export async function removeReferrer(id: string) {
  await deleteObjects([referrerLogoKey(id)]).catch(() => {});
  await prisma.referrer.deleteMany({ where: { id } });
}

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
