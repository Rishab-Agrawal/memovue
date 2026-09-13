import { expect, test } from "@playwright/test";

import {
  GIVEAWAY_MIN_SHOTS,
  REFILL_EARLY_MAX,
  REFILL_MAX,
  half,
  poolFrom,
  poolMoves,
  refillsLeft,
} from "@/lib/roll-config";

/**
 * The shots pool, which is the one place in this app where film changes hands.
 *
 * Every rule here is a pure function precisely so it can be pinned: the server clamps each
 * move against them and the screens draw their ceilings from them, so a disagreement between
 * the two ends would be somebody handing back film they needed, or drawing film that does
 * not exist.
 */
const HOUR = 3_600_000;
const firstShotAt = new Date("2026-09-12T18:00:00Z");
/** Ten hours from the first shot to the close, so a tenth is one hour and a quarter is two and a half. */
const finishesAt = new Date(firstShotAt.getTime() + 10 * HOUR);
const at = (hours: number) => new Date(firstShotAt.getTime() + hours * HOUR);

const roll = {
  maxGuests: 10,
  photosPerGuest: 24,
  giveawayAllowed: true,
  firstShotAt: firstShotAt as Date | null,
  finishesAt,
};

/** Well past a quarter of the way through, where only the lifetime ceiling is left. */
const settled = at(6);
const fresh = { fromPool: 0, shotsLeft: 0, refills: 0 };

test("the pool is the film of everyone who never turned up, plus what is handed back", () => {
  // Nobody in yet: the whole roll.
  expect(poolFrom(roll, 0, 0)).toBe(240);
  // Four guests standing in it, each holding their own twenty-four.
  expect(poolFrom(roll, 4, 0)).toBe(144);
  // One of them hands six back, another draws twelve out.
  expect(poolFrom(roll, 4, -6)).toBe(150);
  expect(poolFrom(roll, 4, 12)).toBe(132);
  // A full roll drawn a little over its size still reads as empty rather than as a negative.
  expect(poolFrom(roll, 10, 30)).toBe(0);
});

test("a guest keeps half their allowance, counting what they have already shot", () => {
  expect(poolMoves(roll, { ...fresh, shotsLeft: 24 }, 200, settled).give).toBe(12);

  // Six given away leaves six more they may give, so the lifetime total is still half.
  expect(poolMoves(roll, { ...fresh, fromPool: -6, shotsLeft: 18 }, 200, settled).give).toBe(6);
  // And once twelve are gone, none.
  expect(poolMoves(roll, { ...fresh, fromPool: -12, shotsLeft: 12 }, 200, settled).give).toBe(0);

  // Nothing in hand is nothing to give, whatever the ceiling says.
  expect(poolMoves(roll, { ...fresh, fromPool: -6 }, 200, settled).give).toBe(0);
});

/**
 * The case a lifetime cap gets wrong.
 *
 * Give six away, spend the remaining eighteen, then draw twelve out of the pool. Those twelve
 * were never part of the half they had to keep — they have already kept it, by shooting it —
 * so every one of them can go back. A rule capping the total given at twelve would offer six.
 */
test("film drawn out of the pool can go straight back into it", () => {
  const drawn = poolMoves(roll, { fromPool: 6, shotsLeft: 12, refills: 1 }, 100, settled);
  expect(drawn.give).toBe(12);
});

test("taking tops a guest up to half an allowance, and never past the pool", () => {
  // Half the roll's allowance per go, or the whole pool if that is smaller.
  expect(poolMoves(roll, fresh, 100, settled).take).toBe(12);
  expect(poolMoves(roll, fresh, 5, settled).take).toBe(5);
  expect(poolMoves(roll, fresh, 0, settled).take).toBe(0);

  // A ceiling on what they may hold, not a rule about being at exactly zero. A frame still
  // in this phone's upload queue leaves the server a shot behind; that guest has just run
  // out and must not be refused for it.
  expect(poolMoves(roll, { ...fresh, shotsLeft: 1 }, 100, settled).take).toBe(11);

  // Topped up already: nothing more until they shoot it, which is what stops the per-go
  // ceiling being a formality.
  expect(poolMoves(roll, { fromPool: 12, shotsLeft: 12, refills: 1 }, 100, settled).take).toBe(0);
  expect(poolMoves(roll, { ...fresh, shotsLeft: 24 }, 100, settled).take).toBe(0);
});

/**
 * The clock, which is about who the film reaches rather than how much of it there is.
 *
 * Somebody who empties their camera in the first twenty minutes of a wedding is shooting the
 * room filling up; the people the pool exists for have not arrived yet.
 */
test("the pool is shut for a tenth of the time from first shot to close, and thin for a quarter", () => {
  // Before anybody has shot, however late it is: nothing at all.
  expect(refillsLeft({ ...roll, firstShotAt: null }, 0, at(9))).toBe(0);

  // Through the first hour of ten after the first shot: still nothing.
  expect(refillsLeft(roll, 0, firstShotAt)).toBe(0);
  expect(refillsLeft(roll, 0, at(0.99))).toBe(0);

  // From a tenth to a quarter: two, which is one whole allowance at half an allowance a go.
  expect(refillsLeft(roll, 0, at(1))).toBe(REFILL_EARLY_MAX);
  expect(refillsLeft(roll, 1, at(2))).toBe(1);
  expect(refillsLeft(roll, 2, at(2))).toBe(0);

  // Past a quarter the clock stops mattering and the lifetime ceiling is all that is left —
  // and refills taken early count against it.
  expect(refillsLeft(roll, 2, at(2.5))).toBe(REFILL_MAX - 2);
  expect(refillsLeft(roll, 0, at(2.5))).toBe(REFILL_MAX);
  expect(refillsLeft(roll, REFILL_MAX, at(9))).toBe(0);
  // Never negative, however the ceiling moved under them.
  expect(refillsLeft(roll, 99, at(9))).toBe(0);
});

test("a guest with no refills left is offered nothing, however full the pool is", () => {
  expect(poolMoves(roll, fresh, 500, at(0.5)).take).toBe(0);
  expect(poolMoves(roll, { ...fresh, refills: 2 }, 500, at(2)).take).toBe(0);
  expect(poolMoves(roll, { ...fresh, refills: REFILL_MAX }, 500, at(9)).take).toBe(0);

  // Ten refills of twelve is five times their own allowance drawn from the shared half.
  expect(REFILL_MAX * half(roll.photosPerGuest)).toBe(5 * roll.photosPerGuest);

  // Neither clock nor count touches the other two moves.
  const gave = { fromPool: -12, shotsLeft: 12, refills: REFILL_MAX };
  expect(poolMoves(roll, gave, 100, at(0.5)).back).toBe(12);
  expect(poolMoves(roll, { ...gave, fromPool: -6, shotsLeft: 24 }, 100, at(0.5)).give).toBe(6);
});

test("an odd allowance rounds in the guest's favour", () => {
  const eleven = { ...roll, photosPerGuest: 11 };
  expect(half(11)).toBe(5);
  // Five may go, six stay — never half a frame more than half.
  expect(poolMoves(eleven, { ...fresh, shotsLeft: 11 }, 100, settled).give).toBe(5);
  expect(poolMoves(eleven, fresh, 100, settled).take).toBe(5);
});

/**
 * Giving away is the host's to allow, and needs a roll with film to spare.
 *
 * Drawing from the pool is neither: that film belongs to guests who never turned up, and
 * nobody chose to keep it. So both gates close over `give` alone.
 */
test("the host's switch and a big enough roll both gate giving away", () => {
  const shut = { ...roll, giveawayAllowed: false };
  expect(poolMoves(shut, { ...fresh, shotsLeft: 24 }, 100, settled).give).toBe(0);

  const five = { ...roll, photosPerGuest: 5 };
  expect(five.photosPerGuest).toBeLessThan(GIVEAWAY_MIN_SHOTS);
  expect(poolMoves(five, { ...fresh, shotsLeft: 5 }, 100, settled).give).toBe(0);

  // Neither gate touches what a guest may draw out.
  expect(poolMoves(shut, fresh, 100, settled).take).toBe(12);
  expect(poolMoves(five, fresh, 100, settled).take).toBe(2);
});

/**
 * Taking back is undoing a gift, so it answers to no ceiling but its own.
 *
 * It is offered with film still in hand, it survives the host closing the door afterwards,
 * and it is bounded only by what is left of what they gave — if somebody else has taken it,
 * what remains is what they get.
 */
test("a gift can be reclaimed, but only as much of it as is still there", () => {
  const gave = { fromPool: -12, shotsLeft: 12, refills: 0 };

  expect(poolMoves(roll, gave, 100, settled).back).toBe(12);
  // Eight of the twelve have been taken by other people.
  expect(poolMoves(roll, gave, 4, settled).back).toBe(4);
  expect(poolMoves(roll, gave, 0, settled).back).toBe(0);

  // The host closing the door does not trap film on the wrong side of it.
  expect(poolMoves({ ...roll, giveawayAllowed: false }, gave, 100, settled).back).toBe(12);

  // Net, so somebody who gave six and later drew twelve has nothing left to reclaim.
  expect(poolMoves(roll, { fromPool: 6, shotsLeft: 12, refills: 1 }, 100, settled).back).toBe(0);
  expect(poolMoves(roll, { ...fresh, shotsLeft: 24 }, 100, settled).back).toBe(0);
});
