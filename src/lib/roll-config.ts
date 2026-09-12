import { fromWall, startOfWallDay, toWall } from "./format";

/**
 * The shape a host can give a roll: how many people, how many shots each, how far ahead it
 * can be scheduled, and what that costs.
 *
 * Client-safe — no secrets, no server imports — because the wizard renders these and the
 * server validates against the same values. Two lists that have to agree is a bug waiting
 * to happen; one list read from both ends cannot drift.
 */

/** Participant caps, in the order the six boxes appear on the guests step. */
export const PARTICIPANT_TIERS = [25, 50, 100, 200, 350, 500] as const;

/** Shots per person, in the order the six chips appear. There is no unlimited option. */
export const SHOT_TIERS = [5, 10, 16, 24, 36, 100] as const;

/**
 * Rupee pricing: ten a head, half again for the hundred-shot roll.
 *
 * Shots used to carry a multiplier of their own, on the theory that they are what costs us
 * storage. They are — and storage is around one percent of the price, so charging for them
 * only taught hosts to buy fewer of them. A thin album is the thing that stops the next host
 * ever hearing about us, so the shot count is now free to choose. The hundred is the one
 * exception, because it is not more of the same product: it is the only roll nobody can run
 * out of, and what the host is buying there is that nobody does.
 *
 * Two numbers rather than fourteen. A host can be told the whole rule in a sentence, which
 * is worth more than any curve fitted across a grid.
 */
export function priceFor(participantIndex: number, shotIndex: number): number {
  const guests = PARTICIPANT_TIERS[participantIndex];
  if (guests === undefined) return 0;
  return guests * (SHOT_TIERS[shotIndex] === 100 ? 15 : 10);
}

export function formatPrice(rupees: number): string {
  return `₹${rupees.toLocaleString("en-IN")}`;
}

/* ------------------------------------------------------------------ beta */

/**
 * Beta holds two things back at once, so it is one flag rather than two.
 *
 * Nothing is charged yet — rolls are created on a beta allowance, not a payment — so the wizard
 * strikes the price it would charge rather than hiding it, which is the only way a host
 * learns what this will cost before it starts costing. And the hundred-shot roll is not
 * offered: it is four times the storage against a price nobody is paying, and it is the one
 * tier whose economics we have not watched a real event produce yet.
 */
export const BETA = true;

/** Whether a shot count from `SHOT_TIERS` can be picked today. Read by the wizard and the server. */
export function shotsAvailable(shots: number): boolean {
  return !BETA || shots !== 100;
}

/* ------------------------------------------------------------------ the calendar */

/** Weddings get booked years ahead, so the window is generous. Settings can still move it. */
export const START_MAX_YEARS = 2;

/**
 * A roll that runs longer than a week is a mistake, not a plan.
 *
 * It used to be two months, which no real event is — and while we are in beta every day a
 * roll stays open is a day we hold its photographs without knowing what any of this costs at
 * scale. A week covers the longest thing anybody actually shoots as one roll: a wedding
 * week, a trip, a festival.
 */
export const FINISH_MAX_DAYS = 7;

/**
 * The shortest a roll may run.
 *
 * Without a floor the finish only had to differ from the start, and since the calendar and
 * the clock are picked separately a host could set a 3am start and a 2am finish on the same
 * day and get a roll that closed before it opened. Half an hour is short enough never to
 * obstruct a real event and long enough that anything under it is a slip.
 */
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
 * Days on which a roll starting at `startsAt` may close.
 *
 * The floor is the day of the *earliest permitted finish*, not the day of the start. Those
 * differ for a roll starting in the last half hour before midnight: a 23:50 start cannot
 * close on its own day at all, so that day is not offered.
 */
export function finishDateRange(startsAt: Date): DateRange {
  const wall = toWall(startsAt);
  return {
    min: startOfWallDay(earliestFinish(startsAt)),
    max: fromWall(wall.year, wall.month, wall.day + FINISH_MAX_DAYS),
  };
}

export function isWithin(day: Date, range: DateRange): boolean {
  const at = startOfWallDay(day).getTime();
  return at >= startOfWallDay(range.min).getTime() && at <= startOfWallDay(range.max).getTime();
}

/**
 * A finish that still fits around its start, given one that may no longer.
 *
 * Editing the start after the finish can invalidate it from either end — moving it forward
 * past the finish, or back so far that the finish breaks the one-week ceiling. The wizard
 * runs this whenever the start moves so the pair it carries is always a legal one, rather
 * than letting the host discover it on the last screen of six.
 */
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
 * A roll's window after its opening time is moved, or `null` if it may not be.
 *
 * One rule, asked by the settings screen to show what a move would do and by the server to
 * do it — the two cannot disagree about a date that is the difference between a guest having
 * a camera and not.
 *
 * The window is narrow on purpose. Once the event has begun the start is history: guests are
 * mid-roll, and a start pushed back into the future would make a shot roll look unstarted to
 * everything that reads it, including the allowance refunded when an unstarted roll is
 * deleted. Before the first moment nothing has been photographed and nothing derived.
 */
export function movedStart(
  roll: { startsAt: Date; finishesAt: Date },
  wanted: Date,
  now: Date = new Date(),
): { startsAt: Date; finishesAt: Date } | null {
  if (roll.startsAt.getTime() <= now.getTime()) return null;

  // Never behind the present — that is a roll which opened at a moment nobody could have shot
  // in. Pulling it forward as far as now is the legitimate "we're starting early".
  const startsAt = new Date(Math.max(wanted.getTime(), now.getTime()));
  if (!isWithin(startsAt, startDateRange(now))) return null;

  // The close comes along when it has to, by the same pairing rule the wizard runs.
  return { startsAt, finishesAt: clampFinish(startsAt, roll.finishesAt) };
}

/** Hours a host may add on top of the close before photos open. */
export const MIN_DELAY_HOURS = 1;
export const MAX_DELAY_HOURS = 72;

/* ------------------------------------------------------------------ visibility */

/**
 * The two states of the one switch a host can flip after a roll exists, worded once.
 *
 * The wizard and the settings sheet had their own copies, and the settings sheet's was not a
 * pair at all — it hardcoded the "on" wording as a static row label, so turning visibility off
 * left the screen still reading "Everyone can see all photos" underneath a switch that was
 * plainly off. A label that does not move is worse than no label: it is a wrong one.
 */
export const VISIBILITY_LABEL = {
  on: "Everyone can see all photos",
  off: "Only host can see all photos",
} as const;

export function visibilityLabel(everyoneCanSee: boolean): string {
  return everyoneCanSee ? VISIBILITY_LABEL.on : VISIBILITY_LABEL.off;
}
