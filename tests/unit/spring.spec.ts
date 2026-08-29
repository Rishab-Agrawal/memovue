import { expect, test } from "@playwright/test";

import { swipeDelta, velocityFrom } from "@/lib/spring";

/**
 * Which frame a swipe lands on.
 *
 * The album viewer only showed one photograph and had no way to reach the next, so looking
 * through a roll meant closing and reopening for every frame. These are the thresholds that
 * decide what a gesture meant — the part worth pinning down, since the rest of it is React.
 */

const WIDTH = 400;
const of = (dx: number, velocity: number, index = 1, count = 3) =>
  swipeDelta({ dx, velocity, width: WIDTH, index, count });

test.describe("reading a swipe", () => {
  test("a short slow drag falls back", () => {
    expect(of(-40, -50)).toBe(0);
  });

  test("dragged more than a quarter of the way across, it goes", () => {
    expect(of(-150, -50)).toBe(1);
    expect(of(150, 50)).toBe(-1);
  });

  /**
   * The reason velocity is projected rather than the release position simply measured. A
   * flick barely moves the finger before it leaves the glass, and refusing it is the thing
   * that makes a gallery feel stuck.
   */
  test("a short hard flick goes anyway", () => {
    expect(of(-30, -900)).toBe(1);
    expect(of(30, 900)).toBe(-1);
  });

  test("the ends do not move", () => {
    expect(of(200, 900, 0, 3)).toBe(0);
    expect(of(-200, -900, 2, 3)).toBe(0);
  });

  test("a single photograph never moves in either direction", () => {
    expect(of(-300, -2000, 0, 1)).toBe(0);
    expect(of(300, 2000, 0, 1)).toBe(0);
  });
});

test.describe("release velocity", () => {
  test("is measured across the window, not the last two samples", () => {
    // 100px in 100ms is 1000px/s, even though the finger stalled for the final frame.
    const samples = [
      { v: 0, t: 0 },
      { v: 60, t: 60 },
      { v: 100, t: 99 },
      { v: 100, t: 100 },
    ];
    expect(Math.round(velocityFrom(samples))).toBe(1000);
  });

  test("is zero when there is nothing to measure", () => {
    expect(velocityFrom([])).toBe(0);
    expect(velocityFrom([{ v: 10, t: 5 }])).toBe(0);
    // Two samples in the same millisecond would divide by zero.
    expect(velocityFrom([{ v: 0, t: 7 }, { v: 90, t: 7 }])).toBe(0);
  });
});
