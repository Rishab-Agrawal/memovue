import { z } from "zod";

import {
  FINISH_MAX_MONTHS,
  MAX_DELAY_HOURS,
  MIN_DELAY_HOURS,
  PARTICIPANT_TIERS,
  SHOT_TIERS,
  START_MAX_YEARS,
  finishDateRange,
  isWithin,
  startDateRange,
} from "./roll-config";

const participantCaps: number[] = [...PARTICIPANT_TIERS];
const shotCounts: number[] = [...SHOT_TIERS];

/* ------------------------------------------------------------------ rolls */

/**
 * The calendars in the wizard already refuse out-of-range dates. This is the rule; that is
 * a convenience. A form post is trivially replayed with different values, so anything the
 * client clamps has to be clamped again here.
 */
export const createRollSchema = z
  .object({
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
      .refine((n) => shotCounts.includes(n), "Pick how many shots each person gets"),

    everyoneCanSee: z.boolean(),
    coverPreset: z.number().int().min(0).max(8),

    couponCode: z.string().trim().min(1, "Enter your coupon code").max(40),
  })
  .superRefine((data, ctx) => {
    const startsAt = new Date(data.startsAt);
    const finishesAt = new Date(data.finishesAt);

    if (!isWithin(startsAt, startDateRange())) {
      ctx.addIssue({
        code: "custom",
        path: ["startsAt"],
        message: `Pick a start date between today and ${START_MAX_YEARS} years from now`,
      });
    }

    if (finishesAt.getTime() <= startsAt.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["finishesAt"],
        message: "The roll has to close after it opens",
      });
      return;
    }

    if (!isWithin(finishesAt, finishDateRange(startsAt))) {
      ctx.addIssue({
        code: "custom",
        path: ["finishesAt"],
        message: `A roll can run for at most ${FINISH_MAX_MONTHS} months`,
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

/** Editing after creation. Deliberately narrower: shots and cap are fixed once sold. */
export const editRollSchema = z.object({
  name: z.string().trim().min(1, "Give your roll a name").max(80),
  coverPreset: z.number().int().min(0).max(8),
});

export const rollScheduleSchema = createRollSchema.innerType().pick({
  startsAt: true,
  finishesAt: true,
  revealMode: true,
  revealDelayHours: true,
});

export const rollVisibilitySchema = z.object({ everyoneCanSee: z.boolean() });

/* ------------------------------------------------------------------ guests */

/**
 * A name and nothing else. The old schema also collected which side of a wedding a guest
 * was on, or how they knew the birthday person — questions that existed because rolls had
 * types. They don't any more.
 */
export const joinRollSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(40),
});

/* ------------------------------------------------------------------ photos */

export const photoInitSchema = z.object({
  contentType: z.literal("image/jpeg"),
});

export const photoConfirmSchema = z.object({
  photoId: z.string().min(1),
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
  bytes: z.number().int().positive(),
  // Tiny inline placeholder; a real one is ~600-1200 chars.
  blurData: z.string().max(4000),
});

/* ------------------------------------------------------------------ account */

export const updateNameSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(60),
});

/* ------------------------------------------------------------------ admin */

export const mintCouponSchema = z.object({
  note: z.string().trim().max(120).optional(),
  count: z.number().int().min(1).max(50),
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
