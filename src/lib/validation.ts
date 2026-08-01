import { z } from "zod";

import {
  EVENT_TYPES,
  GUEST_COUNT_OPTIONS,
  MAX_PHOTOS_PER_GUEST,
  MIN_PHOTOS_PER_GUEST,
  REVEAL_OPTIONS,
  eventTypeConfig,
} from "./event-types";

const eventTypeValues = EVENT_TYPES.map((t) => t.value) as [string, ...string[]];
// Widened to number: these are compared against arbitrary user input, not literals.
const revealHours: number[] = REVEAL_OPTIONS.map((r) => r.hours);

/* ------------------------------------------------------------------ host accounts */

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(60),
  email: z.email("Please enter a valid email").toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  inviteCode: z.string().trim().max(20).optional(),
});

export const loginSchema = z.object({
  email: z.email("Please enter a valid email").toLowerCase(),
  password: z.string().min(1, "Please enter your password"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Use at least 8 characters").max(200),
});

export const accessRequestSchema = z.object({
  eventKind: z.string().trim().min(1, "Tell us what you're hosting").max(80),
  expectedDate: z.string().trim().max(40).optional(),
  guestEstimate: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(30).optional(),
  note: z.string().trim().max(500).optional(),
});

/* ------------------------------------------------------------------ events */

export const createEventSchema = z
  .object({
    name: z.string().trim().min(1, "Give your event a name").max(80),
    type: z.enum(eventTypeValues),
    partnerA: z.string().trim().max(40).optional(),
    partnerB: z.string().trim().max(40).optional(),
    honoreeName: z.string().trim().max(40).optional(),
    askRelation: z.boolean(),
    maxGuests: z
      .number()
      .int()
      .refine((n) => (GUEST_COUNT_OPTIONS as readonly number[]).includes(n), "Pick a guest count"),
    photosPerGuest: z.number().int().min(MIN_PHOTOS_PER_GUEST).max(MAX_PHOTOS_PER_GUEST),
    startsAt: z.iso.datetime({ offset: true }),
    revealDelayHours: z
      .number()
      .int()
      .refine((n) => revealHours.includes(n), "Pick when photos unlock"),
  })
  .superRefine((data, ctx) => {
    // Which names are mandatory depends entirely on the event type — a wedding needs two
    // people, a birthday needs one, a team offsite needs none.
    const mode = eventTypeConfig(data.type as never).relation;

    if (mode === "sides") {
      if (!data.partnerA) {
        ctx.addIssue({ code: "custom", path: ["partnerA"], message: "Required" });
      }
      if (!data.partnerB) {
        ctx.addIssue({ code: "custom", path: ["partnerB"], message: "Required" });
      }
    }
    if (mode === "honoree" && !data.honoreeName) {
      ctx.addIssue({ code: "custom", path: ["honoreeName"], message: "Required" });
    }
  });

/* ------------------------------------------------------------------ guests */

export const joinEventSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(40),
  relationSide: z.enum(["A", "B", "BOTH"]).optional(),
  relation: z.string().trim().max(60).optional(),
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

/* ------------------------------------------------------------------ admin */

export const inviteCodeSchema = z.object({
  note: z.string().trim().max(120).optional(),
  maxUses: z.number().int().min(1).max(500),
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
