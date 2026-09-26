import { fromWall, startOfWallDay, toWall } from "./format";

/**
 * The shape a host can give a roll: people, shots, schedule and price.
 *
 * Client-safe, so the wizard renders the same values the server validates against.
 */

/** Participant caps, in the order the six boxes appear on the guests step. */
export const PARTICIPANT_TIERS = [25, 50, 100, 200, 350, 500] as const;

/** Shots per person, in the order the six chips appear. There is no unlimited option. */
export const SHOT_TIERS = [5, 10, 16, 24, 36, 100] as const;

/**
 * Rupee pricing: ten a head, fifteen for the hundred-shot roll. Shot count is otherwise free,
 * because storage is about one percent of the price and a thin album is what loses the next host.
 */
export function priceFor(participantIndex: number, shotIndex: number): number {
  const guests = PARTICIPANT_TIERS[participantIndex];
  if (guests === undefined) return 0;
  return guests * (SHOT_TIERS[shotIndex] === 100 ? 15 : 10);
}

export function formatPrice(rupees: number): string {
  return `₹${rupees.toLocaleString("en-IN")}`;
}

/**
 * Whether a shot count from `SHOT_TIERS` can be picked today. Read by the wizard and the server.
 * The hundred-shot roll is held back until its economics have been seen at a real event.
 */
export function shotsAvailable(shots: number): boolean {
  return shots !== 100;
}

/* ------------------------------------------------------------------ the calendar */

/** Weddings get booked years ahead, so the window is generous. Settings can still move it. */
export const START_MAX_YEARS = 2;

/** A roll that runs longer than a month is a mistake, not a plan. */
export const FINISH_MAX_MONTHS = 1;

/** The shortest a roll may run, so a finish picked on a separate clock cannot precede the start. */
export const MIN_ROLL_MINUTES = 30;

/** The first instant a roll starting at `startsAt` is allowed to close. */
export function earliestFinish(startsAt: Date): Date {
  return new Date(startsAt.getTime() + MIN_ROLL_MINUTES * 60_000);
}

export interface DateRange {
  min: Date;
  max: Date;
}

/** Bounds are wall-clock days in the app's zone, matching what the calendar draws. */
export function startDateRange(now: Date = new Date()): DateRange {
  const wall = toWall(now);
  return {
    min: startOfWallDay(now),
    max: fromWall(wall.year + START_MAX_YEARS, wall.month, wall.day),
  };
}

/**
 * Days on which a roll starting at `startsAt` may close. The floor is the day of the earliest
 * permitted finish, so a 23:50 start does not offer its own day.
 */
export function finishDateRange(startsAt: Date): DateRange {
  const wall = toWall(startsAt);
  return {
    min: startOfWallDay(earliestFinish(startsAt)),
    max: fromWall(wall.year, wall.month + FINISH_MAX_MONTHS, wall.day),
  };
}

export function isWithin(day: Date, range: DateRange): boolean {
  const at = startOfWallDay(day).getTime();
  return at >= startOfWallDay(range.min).getTime() && at <= startOfWallDay(range.max).getTime();
}

/** A finish that still fits around its start. The wizard runs this whenever the start moves. */
export function clampFinish(startsAt: Date, finishesAt: Date): Date {
  const earliest = earliestFinish(startsAt);
  if (finishesAt.getTime() < earliest.getTime()) return earliest;

  const range = finishDateRange(startsAt);
  if (!isWithin(finishesAt, range)) {
    // Keep the time of day the host chose and pull the date back onto the last legal one.
    const last = toWall(range.max);
    const kept = toWall(finishesAt);
    return fromWall(last.year, last.month, last.day, kept.hour, kept.minute);
  }

  return finishesAt;
}

/**
 * A roll's window after its opening time is moved, or `null` if it may not be. Shared by the
 * settings preview and the server write.
 *
 * Only before the event begins, and never behind the present: once guests are shooting, the
 * start is history.
 */
export function movedStart(
  roll: { startsAt: Date; finishesAt: Date },
  wanted: Date,
  now: Date = new Date(),
): { startsAt: Date; finishesAt: Date } | null {
  if (roll.startsAt.getTime() <= now.getTime()) return null;

  const startsAt = new Date(Math.max(wanted.getTime(), now.getTime()));
  if (!isWithin(startsAt, startDateRange(now))) return null;

  return { startsAt, finishesAt: clampFinish(startsAt, roll.finishesAt) };
}

/** Hours a host may add on top of the close before photos open. */
export const MIN_DELAY_HOURS = 1;
export const MAX_DELAY_HOURS = 72;

/* ------------------------------------------------------------------ switches */

/** Both states of the visibility switch, worded once for the wizard and the settings sheet. */
export const VISIBILITY_LABEL = {
  on: "Everyone can see all photos",
  off: "Only host can see all photos",
} as const;

/* ------------------------------------------------------------------ the shots pool */

/**
 * The shots pool and shots giveaway, off: every person gets the fixed allowance the host
 * bought, and no film moves between them.
 *
 * One switch for the whole feature. The two rules below answer to it — the pool reads empty
 * and no move is ever offered — so every count, dialog and refusal downstream follows without
 * being told. The screens that would otherwise draw it check it too: the host’s pool button
 * beside Invite (`RollParts`), the guest’s under theirs (`RollHeader`), the camera counter’s
 * link (`GuestApp`), the pool screen itself, and the giveaway switch in the wizard and in
 * settings. The rules themselves stay pinned by `tests/unit/shots-pool.spec.ts`, which skips
 * itself while this is false.
 *
 * Turning it back on restores every one of them.
 */
export const SHOTS_POOL = false;

/**
 * A roll is bought as `maxGuests × photosPerGuest` frames. The pool is what is left over: the
 * film of everybody who never turned up, plus whatever guests hand back.
 *
 * Derived from the guest rows rather than stored, so resizing the roll cannot leave it stale.
 */
export function poolFrom(
  roll: { maxGuests: number; photosPerGuest: number },
  joined: number,
  /** Net film drawn out of the pool by those guests; negative once more is given than taken. */
  drawn: number,
): number {
  if (!SHOTS_POOL) return 0;
  return Math.max(0, (roll.maxGuests - joined) * roll.photosPerGuest - drawn);
}

/** Half a guest's own allowance, rounded down: the most that moves in one go, either way. */
export function half(photosPerGuest: number): number {
  return Math.floor(photosPerGuest / 2);
}

/**
 * The smallest roll on which giving film away means anything. Below it the switch is not drawn;
 * `giveawayOffered` still checks, since a roll can be resized down after the switch is on.
 */
export const GIVEAWAY_MIN_SHOTS = 10;

/** Both states of the host's giveaway switch, worded once. */
export const GIVEAWAY_LABEL = {
  on: "Shots giveaway allowed",
  off: "No shots giveaway",
} as const;

/** What the question mark beside that switch says. Only ever asked on a roll that offers it. */
export function giveawayHelp(photosPerGuest: number): string {
  return (
    `This feature allows guests to giveaway ${half(photosPerGuest)} of their shots to the ` +
    `common pool, for others to use if they run out of shots.`
  );
}

/** Whether this roll offers giving away at all: the host's switch, and enough film to mean it. */
export function giveawayOffered(roll: {
  photosPerGuest: number;
  giveawayAllowed: boolean;
}): boolean {
  return roll.giveawayAllowed && roll.photosPerGuest >= GIVEAWAY_MIN_SHOTS;
}

/* ------------------------------------------------------- how often, and how soon */

/**
 * Measured from the roll's first shot to its close, the pool is shut for the first tenth,
 * capped at two refills for the first quarter, and at ten for good after that — so the film
 * reaches people who arrive later, not whoever empties their camera while the room fills up.
 * The first shot rather than the start, because a start set hours early would spend the
 * lockout on an empty room.
 */
export const REFILL_LOCKOUT = 0.1;
export const REFILL_EARLY = 0.25;
export const REFILL_EARLY_MAX = 2;
export const REFILL_MAX = 10;

/** Refills this guest has left, counting both the clock and everything they have taken. */
export function refillsLeft(
  roll: { firstShotAt: Date | null; finishesAt: Date },
  refills: number,
  now: Date,
): number {
  // Nobody has shot, so nobody has run out.
  if (!roll.firstShotAt) return 0;
  const span = roll.finishesAt.getTime() - roll.firstShotAt.getTime();
  // Only corrupt dates make it non-positive; "over" is the safe answer.
  const elapsed = span > 0 ? (now.getTime() - roll.firstShotAt.getTime()) / span : 1;
  if (elapsed < REFILL_LOCKOUT) return 0;
  if (elapsed < REFILL_EARLY) return Math.max(0, REFILL_EARLY_MAX - refills);
  return Math.max(0, REFILL_MAX - refills);
}

/**
 * What one guest may move, in each direction, right now.
 *
 * - `give`: down to the half of their original allowance they must keep, counting what they
 *   have shot — so film drawn from the pool can all be handed back.
 * - `take`: tops them up to half an allowance and no further. A ceiling rather than "only when
 *   empty", because a frame still in the phone's queue is not in the server's count yet.
 * - `back`: undoing their own gift, bounded only by what they gave and what is still there.
 *   Answers to neither the clock nor the switch, so closing giveaways cannot trap film.
 */
export function poolMoves(
  roll: {
    photosPerGuest: number;
    giveawayAllowed: boolean;
    firstShotAt: Date | null;
    finishesAt: Date;
  },
  guest: { fromPool: number; shotsLeft: number; refills: number },
  pool: number,
  now: Date = new Date(),
): { take: number; give: number; back: number } {
  if (!SHOTS_POOL) return { take: 0, give: 0, back: 0 };

  const allowance = roll.photosPerGuest + guest.fromPool;
  const keep = roll.photosPerGuest - half(roll.photosPerGuest);
  return {
    take:
      refillsLeft(roll, guest.refills, now) > 0
        ? Math.max(0, Math.min(pool, half(roll.photosPerGuest) - guest.shotsLeft))
        : 0,
    give: giveawayOffered(roll)
      ? Math.max(0, Math.min(guest.shotsLeft, allowance - keep))
      : 0,
    back: Math.max(0, Math.min(pool, -guest.fromPool)),
  };
}
