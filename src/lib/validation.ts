import { z } from "zod";

import { UPLOAD_LIMITS } from "./constants";

import {
  MAX_DELAY_HOURS,
  MIN_DELAY_HOURS,
  MIN_ROLL_MINUTES,
  PARTICIPANT_TIERS,
  SHOT_TIERS,
  START_MAX_YEARS,
  earliestFinish,
  finishDateRange,
  isWithin,
  shotsAvailable,
  startDateRange,
} from "./roll-config";

const participantCaps: number[] = [...PARTICIPANT_TIERS];
const shotCounts: number[] = [...SHOT_TIERS];

/* ------------------------------------------------------------------ referrals */

/** As long as a code can be without being a paragraph. Normalised before it is looked up. */
const referralCode = z.string().trim().min(1, "Enter a referral code").max(40);

export const checkReferralSchema = z.object({ code: referralCode });

/**
 * Optional, and an `https://` link when given: these end up in an `href` and an `<img src>` on a
 * page served over TLS, where anything else is either blocked as mixed content or a javascript:
 * URL somebody typed into the admin screen.
 */
const optionalLink = z
  .string()
  .trim()
  .max(300)
  .refine((value) => value === "" || /^https:\/\/\S+$/.test(value), "Links must start with https://")
  .optional();

/** One schema for minting a code and for editing one: an `id` is the only difference. */
export const saveReferrerSchema = z.object({
  id: z.string().min(1).optional(),
  code: referralCode,
  name: z.string().trim().min(1, "Name the business").max(60),
  url: optionalLink,
  logoUrl: optionalLink,
  /** Told about every roll created with the code. Empty means tell them nothing. */
  email: z
    .union([z.email("That doesn't look like an email address").max(160), z.literal("")])
    .optional(),
});

export const removeReferrerSchema = z.object({ id: z.string().min(1) });

/* ------------------------------------------------------------------ rolls */

/** The wizard clamps these too, but a form post is trivially replayed, so this is the rule. */
const rollFields = z.object({
    name: z.string().trim().min(1, "Give your roll a name").max(80),

    startsAt: z.iso.datetime({ offset: true }),
    finishesAt: z.iso.datetime({ offset: true }),

    revealMode: z.enum(["DURING", "AFTER", "DELAY"]),
    revealDelayHours: z.number().int().min(0).max(MAX_DELAY_HOURS),

    maxGuests: z
      .number()
      .int()
      .refine((n) => participantCaps.includes(n), "Pick a participant count"),
    photosPerGuest: z
      .number()
      .int()
      .refine((n) => shotCounts.includes(n) && shotsAvailable(n), "Pick how many shots each person gets"),

    everyoneCanSee: z.boolean(),
    giveawayAllowed: z.boolean(),
    coverPreset: z.number().int().min(0).max(8),

    /** A wedding business's code. Shape only — whether it names one is a database question. */
    referralCode: referralCode.optional(),
});

export const createRollSchema = rollFields.superRefine((data, ctx) => {
    const startsAt = new Date(data.startsAt);
    const finishesAt = new Date(data.finishesAt);

    if (!isWithin(startsAt, startDateRange())) {
      ctx.addIssue({
        code: "custom",
        path: ["startsAt"],
        message: `Pick a start date between today and ${START_MAX_YEARS} years from now`,
      });
    }

    if (finishesAt.getTime() < earliestFinish(startsAt).getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["finishesAt"],
        message: `A roll has to run for at least ${MIN_ROLL_MINUTES} minutes`,
      });
      return;
    }

    if (!isWithin(finishesAt, finishDateRange(startsAt))) {
      ctx.addIssue({
        code: "custom",
        path: ["finishesAt"],
        message: "A roll can run for at most a month",
      });
    }

    if (data.revealMode === "DELAY" && data.revealDelayHours < MIN_DELAY_HOURS) {
      ctx.addIssue({
        code: "custom",
        path: ["revealDelayHours"],
        message: `Add at least ${MIN_DELAY_HOURS} hour`,
      });
    }
  });

/** Name and cover. Size, dates and reveal each have their own schema below. */
export const editRollSchema = z.object({
  name: z.string().trim().min(1, "Give your roll a name").max(80),
  coverPreset: z.number().int().min(0).max(8),
});

/** Shape only; `clampFinish` holds it to the roll's own start server-side. */
export const editFinishSchema = z.object({
  finishesAt: z.iso.datetime({ offset: true }),
});

/** Shape only; `updateRollStart` holds it to the roll's own state. */
export const editStartSchema = z.object({
  startsAt: z.iso.datetime({ offset: true }),
});

/** The wizard's own tiers and beta ceiling, so a hundred-shot roll cannot be bought here either. */
export const editSizeSchema = rollFields.pick({ maxGuests: true, photosPerGuest: true }).partial();

/** The wizard's two reveal fields. The moment itself is derived from the roll, never posted. */
export const editRevealSchema = rollFields
  .pick({ revealMode: true, revealDelayHours: true })
  .refine((data) => data.revealMode !== "DELAY" || data.revealDelayHours >= MIN_DELAY_HOURS, {
    path: ["revealDelayHours"],
    message: `Add at least ${MIN_DELAY_HOURS} hour`,
  });

/* ------------------------------------------------------------------ guests */

export const joinRollSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(40),
});

/* ------------------------------------------------------------------ photos */

/**
 * The sizes an upload URL is signed for. The ceiling stops the declaration itself being the
 * abuse: otherwise a caller declares five gigabytes and gets a URL good for exactly that.
 */
const uploadBytes = z.number().int().positive().max(UPLOAD_LIMITS.maxBytes);

export const photoInitSchema = z.object({
  contentType: z.literal("image/jpeg"),
  fullBytes: uploadBytes,
  previewBytes: uploadBytes,
});

/** Re-signing a reservation. Same blobs as the first attempt, so the same two lengths. */
export const photoResignSchema = photoInitSchema.pick({
  fullBytes: true,
  previewBytes: true,
});

/** A cover has one derivative rather than three, and a tighter ceiling than a photograph. */
export const coverInitSchema = z.object({
  bytes: z.number().int().positive().max(UPLOAD_LIMITS.coverMaxBytes),
});

export const photoConfirmSchema = z.object({
  photoId: z.string().min(1),
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
  bytes: z.number().int().positive(),
  // Tiny inline placeholder; a real one is ~600-1200 chars.
  blurData: z.string().max(4000),
  // When the shutter fired. Optional for photos queued by older clients; clamped by `takenAtWithin`.
  takenAt: z.iso.datetime({ offset: true }).optional(),
});

/* ------------------------------------------------------------------ account */

export const updateNameSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(60),
});

/* ------------------------------------------------------------------ admin */

/** The address an admin types into the beta list. Lower-cased on the way to the database. */
export const grantAccessSchema = z.object({
  email: z.email("That doesn't look like an email address").max(160),
});

export const adjustAccessSchema = z.object({
  id: z.string().min(1),
  /** One step per tap, so an admin typo cannot grant 900 rolls. */
  delta: z.union([z.literal(1), z.literal(-1)]),
});

export const revokeAccessSchema = adjustAccessSchema.pick({ id: true });

/* ------------------------------------------------------------------ beta requests */

/** Asking for access. No email field: the signed-in address is the one an admin must allow. */
export const betaRequestSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(60),
  phone: z.string().trim().max(30).optional(),
  eventType: z.string().trim().min(1, "What kind of event is it?").max(60),
  remarks: z.string().trim().max(500).optional(),
});

/** Flattens a ZodError into { field: message } for rendering next to inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** The first thing wrong, for a screen with one place to say it. */
export function firstError(error: z.ZodError): string {
  return Object.values(fieldErrors(error))[0] ?? "Invalid";
}

/** What a server action answers when the screen has one line to report it in. */
export type ActionResult = { ok: true } | { ok: false; error: string };
