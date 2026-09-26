"use server";

import { revalidatePath } from "next/cache";

import { normalizeCode, rollCode } from "@/lib/codes";
import { UPLOAD_LIMITS } from "@/lib/constants";
import { sendReferralCode } from "@/lib/email";
import { rateLimit } from "@/lib/ratelimit";
import { isReservedCode, removeReferrer, saveReferrer, saveSampleSponsor } from "@/lib/referrals";
import { requireAdmin } from "@/lib/session";
import {
  type ActionResult,
  firstError,
  removeReferrerSchema,
  saveReferrerSchema,
  sponsorSchema,
} from "@/lib/validation";

/**
 * `requireAdmin`, with a ceiling on how fast the queue can be worked through.
 *
 * The threat here is not really an attacker — an admin session is already the keys to the
 * building, and a limit does not change that. It is that one tap is one write, and a held
 * finger or a stuck retry is an unbounded number of them. Every action goes through here so a
 * new one cannot forget it.
 */
async function withinAdminBudget(): Promise<ActionResult | null> {
  const user = await requireAdmin();
  if (rateLimit(`admin:${user.id}`, 120, 60).ok) return null;
  return { ok: false, error: "Too fast — give that a second." };
}

/* ------------------------------------------------------------------ referrals */

/**
 * The logo riding along with a card, if there is one. The browser has already decoded and
 * shrunk it (see `processLogo`), so what arrives is a few tens of kilobytes; the ceiling here
 * is the guard on that claim, since the form is not what posts it that is trusted.
 */
async function logoBytes(form: FormData): Promise<Uint8Array | null | Error> {
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > UPLOAD_LIMITS.logoMaxBytes) return new Error("That image is too large.");
  return new Uint8Array(await file.arrayBuffer());
}

/**
 * Mints a code, or edits one — same form, same action, an `id` apart. An individual's code is
 * one roll, and one left blank is picked here.
 *
 * `FormData` rather than a plain object because a logo may ride along, for a business with no
 * URL of its own to point at.
 */
export async function saveReferrerAction(form: FormData): Promise<ActionResult> {
  const over = await withinAdminBudget();
  if (over) return over;

  const parsed = saveReferrerSchema.safeParse({
    id: form.get("id") || undefined,
    kind: form.get("kind"),
    code: form.get("code") || (form.get("kind") === "INDIVIDUAL" ? rollCode() : ""),
    email: form.get("email") ?? "",
    sendEmail: form.get("sendEmail") === "on",
    maxUses: form.get("maxUses"),
    name: form.get("name") ?? "",
    url: form.get("url") ?? "",
    logoUrl: form.get("logoUrl") ?? "",
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const data = parsed.data;

  // The sample album's card lives on a row in this table under a code of its own. Minting it
  // here would put a made-up florist on real weddings.
  if (isReservedCode(data.code)) {
    return { ok: false, error: "That code is reserved. Use the sample album card screen." };
  }

  const logo = await logoBytes(form);
  if (logo instanceof Error) return { ok: false, error: logo.message };

  const result = await saveReferrer({
    id: data.id,
    code: data.code,
    kind: data.kind,
    email: data.email || null,
    ...(data.kind === "BUSINESS"
      ? {
          maxUses: data.maxUses,
          name: data.name,
          url: data.url || null,
          logoUrl: data.logoUrl || null,
          logo,
        }
      : { maxUses: 1, name: null, url: null, logoUrl: null, logo: null }),
  });

  if (result === "code-taken") return { ok: false, error: "That code is already taken." };
  if (result === "not-found") return { ok: false, error: "That code no longer exists." };

  if (data.sendEmail && data.email) await sendReferralCode(data.email, normalizeCode(data.code));

  revalidatePath("/admin/referrals");
  return { ok: true };
}

/**
 * The made-up card on the sample album, which is a pitch, not a referral. Same three fields a
 * guest sees, and no code or address: nobody can type this one and nobody is emailed about it.
 */
export async function saveSampleCardAction(form: FormData): Promise<ActionResult> {
  const over = await withinAdminBudget();
  if (over) return over;

  const parsed = sponsorSchema.safeParse({
    name: form.get("name") ?? "",
    url: form.get("url") ?? "",
    logoUrl: form.get("logoUrl") ?? "",
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const logo = await logoBytes(form);
  if (logo instanceof Error) return { ok: false, error: logo.message };

  await saveSampleSponsor({
    name: parsed.data.name,
    url: parsed.data.url || null,
    logoUrl: parsed.data.logoUrl || null,
    logo,
  });

  revalidatePath("/admin/sample");
  revalidatePath("/admin/sample/album");
  return { ok: true };
}

/** Retires a code. Rolls it already created keep their row and lose the credit. */
export async function removeReferrerAction(input: { id: string }): Promise<ActionResult> {
  const over = await withinAdminBudget();
  if (over) return over;

  const parsed = removeReferrerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid" };

  await removeReferrer(parsed.data.id);
  revalidatePath("/admin/referrals");
  return { ok: true };
}
