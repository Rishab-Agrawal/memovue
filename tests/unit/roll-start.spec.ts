import { expect, test } from "@playwright/test";

import { MIN_ROLL_MINUTES, movedStart } from "@/lib/roll-config";

/**
 * Moving a roll's opening time, which is the one date change with something to lose.
 *
 * The close, the reveal and the deletion date all hang off the window, and `deleteRoll` hands
 * the beta allowance back for a roll that has not started — so a start that could travel
 * anywhere would be a way to shoot an event and then be refunded for it. The rule is one pure
 * function precisely so it can be pinned here rather than only in a database.
 */
const HOUR = 3_600_000;
const now = new Date("2026-09-13T12:00:00Z");

/** Opens tomorrow noon, closes the day after. */
const roll = {
  startsAt: new Date(now.getTime() + 24 * HOUR),
  finishesAt: new Date(now.getTime() + 48 * HOUR),
};

test("an event that has begun cannot be reopened at another time", () => {
  const begun = { startsAt: new Date(now.getTime() - HOUR), finishesAt: roll.finishesAt };
  expect(movedStart(begun, new Date(now.getTime() + HOUR), now)).toBeNull();

  // The boundary itself counts as begun: at the start instant there is a camera in a hand.
  const starting = { startsAt: now, finishesAt: roll.finishesAt };
  expect(movedStart(starting, new Date(now.getTime() + HOUR), now)).toBeNull();
});

test("a start behind the present is pulled up to it, not refused", () => {
  const moved = movedStart(roll, new Date(now.getTime() - 5 * HOUR), now);
  expect(moved?.startsAt.getTime()).toBe(now.getTime());
});

test("a start past the two-year ceiling is refused outright", () => {
  const far = new Date(now.getTime() + 3 * 365 * 24 * HOUR);
  expect(movedStart(roll, far, now)).toBeNull();
});

test("the close comes along when the new start would crowd or outrun it", () => {
  // Moved past its own finish: the finish is pushed to the shortest legal roll after it.
  const late = new Date(roll.finishesAt.getTime() + 6 * HOUR);
  const moved = movedStart(roll, late, now);
  expect(moved?.finishesAt.getTime()).toBe(late.getTime() + MIN_ROLL_MINUTES * 60_000);

  // Moved earlier, with the finish still comfortably inside the window: it stays put.
  const earlier = movedStart(roll, new Date(now.getTime() + 2 * HOUR), now);
  expect(earlier?.finishesAt.getTime()).toBe(roll.finishesAt.getTime());
});

test("a finish left beyond the one-month ceiling is pulled back onto it", () => {
  const long = { startsAt: roll.startsAt, finishesAt: new Date(now.getTime() + 70 * 24 * HOUR) };
  const moved = movedStart(long, new Date(now.getTime() + 2 * HOUR), now);

  expect(moved).not.toBeNull();
  // The ceiling is a wall-clock day, so the last legal instant is inside the day after it.
  const month = 32 * 24 * HOUR;
  expect(moved!.finishesAt.getTime()).toBeLessThanOrEqual(moved!.startsAt.getTime() + month);
  // And it keeps the time of day the host chose.
  expect(moved!.finishesAt.getUTCMinutes()).toBe(long.finishesAt.getUTCMinutes());
});
