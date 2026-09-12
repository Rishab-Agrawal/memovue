import { expect, test } from "@playwright/test";

import { GIVEAWAY_MIN_SHOTS, half, poolFrom, poolMoves } from "@/lib/roll-config";

/**
 * The shots pool, which is the one place in this app where film changes hands.
 *
 * Both rules are pure functions precisely so they can be pinned here: the server clamps every
 * move against them and the screens draw their ceilings from them, so a disagreement between
 * the two ends would be somebody handing back film they needed, or drawing film that does not
 * exist.
 */
const roll = { maxGuests: 10, photosPerGuest: 24, giveawayAllowed: true };

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
  const fresh = poolMoves(roll, { fromPool: 0, shotsLeft: 24 }, 200);
  expect(fresh.give).toBe(12);

  // Six given away leaves six more they may give, so the lifetime total is still half.
  expect(poolMoves(roll, { fromPool: -6, shotsLeft: 18 }, 200).give).toBe(6);
  // And once twelve are gone, none.
  expect(poolMoves(roll, { fromPool: -12, shotsLeft: 12 }, 200).give).toBe(0);

  // Nothing in hand is nothing to give, whatever the ceiling says.
  expect(poolMoves(roll, { fromPool: -6, shotsLeft: 0 }, 200).give).toBe(0);
});

/**
 * The case a lifetime cap gets wrong.
 *
 * Give six away, spend the remaining eighteen, then draw twelve out of the pool. Those twelve
 * were never part of the half they had to keep — they have already kept it, by shooting it —
 * so every one of them can go back. A rule capping the total given at twelve would offer six.
 */
test("film drawn out of the pool can go straight back into it", () => {
  const drawn = poolMoves(roll, { fromPool: -6 + 12, shotsLeft: 12 }, 100);
  expect(drawn.give).toBe(12);
});

test("taking tops a guest up to half an allowance, and never past the pool", () => {
  // Half the roll's allowance per go, or the whole pool if that is smaller.
  expect(poolMoves(roll, { fromPool: 0, shotsLeft: 0 }, 100).take).toBe(12);
  expect(poolMoves(roll, { fromPool: 0, shotsLeft: 0 }, 5).take).toBe(5);
  expect(poolMoves(roll, { fromPool: 0, shotsLeft: 0 }, 0).take).toBe(0);

  // A ceiling on what they may hold, not a rule about being at exactly zero. A frame still
  // in this phone's upload queue leaves the server a shot behind; that guest has just run
  // out and must not be refused for it.
  expect(poolMoves(roll, { fromPool: 0, shotsLeft: 1 }, 100).take).toBe(11);

  // Topped up already: nothing more until they shoot it, which is what stops the per-go
  // ceiling being a formality.
  expect(poolMoves(roll, { fromPool: 12, shotsLeft: 12 }, 100).take).toBe(0);
  expect(poolMoves(roll, { fromPool: 0, shotsLeft: 24 }, 100).take).toBe(0);
});

test("an odd allowance rounds in the guest's favour", () => {
  const eleven = { photosPerGuest: 11, giveawayAllowed: true };
  expect(half(11)).toBe(5);
  // Five may go, six stay — never half a frame more than half.
  expect(poolMoves(eleven, { fromPool: 0, shotsLeft: 11 }, 100).give).toBe(5);
  expect(poolMoves(eleven, { fromPool: 0, shotsLeft: 0 }, 100).take).toBe(5);
});

/**
 * Giving away is the host's to allow, and needs a roll with film to spare.
 *
 * Drawing from the pool is neither: that film belongs to guests who never turned up, and
 * nobody chose to keep it. So both gates close over `give` alone.
 */
test("the host's switch and a big enough roll both gate giving away", () => {
  expect(poolMoves({ ...roll, giveawayAllowed: false }, { fromPool: 0, shotsLeft: 24 }, 100).give).toBe(0);

  const five = { photosPerGuest: 5, giveawayAllowed: true };
  expect(five.photosPerGuest).toBeLessThan(GIVEAWAY_MIN_SHOTS);
  expect(poolMoves(five, { fromPool: 0, shotsLeft: 5 }, 100).give).toBe(0);

  // Neither gate touches what a guest may draw out.
  expect(poolMoves({ ...roll, giveawayAllowed: false }, { fromPool: 0, shotsLeft: 0 }, 100).take).toBe(12);
  expect(poolMoves(five, { fromPool: 0, shotsLeft: 0 }, 100).take).toBe(2);
});

/**
 * Taking back is undoing a gift, so it answers to neither ceiling.
 *
 * It is offered with film still in hand, it survives the host closing the door afterwards,
 * and it is bounded only by what is left of what they gave — if somebody else has taken it,
 * what remains is what they get.
 */
test("a gift can be reclaimed, but only as much of it as is still there", () => {
  const gave = { fromPool: -12, shotsLeft: 12 };

  expect(poolMoves(roll, gave, 100).back).toBe(12);
  // Eight of the twelve have been taken by other people.
  expect(poolMoves(roll, gave, 4).back).toBe(4);
  expect(poolMoves(roll, gave, 0).back).toBe(0);

  // The host closing the door does not trap film on the wrong side of it.
  expect(poolMoves({ ...roll, giveawayAllowed: false }, gave, 100).back).toBe(12);

  // Net, so somebody who gave six and later drew twelve has nothing left to reclaim.
  expect(poolMoves(roll, { fromPool: 6, shotsLeft: 12 }, 100).back).toBe(0);
  expect(poolMoves(roll, { fromPool: 0, shotsLeft: 24 }, 100).back).toBe(0);
});
