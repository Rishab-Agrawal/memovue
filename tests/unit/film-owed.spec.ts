import { expect, test } from "@playwright/test";

import { carriedForward } from "../../src/lib/upload-queue";

/**
 * How much film this device has spent that the server has not been told about.
 *
 * The camera's quota is counted from `Photo` rows, and a photograph sitting un-uploaded in
 * IndexedDB has no row. Get this wrong in one direction and the viewfinder hands out shots
 * that do not exist — every extra frame comes back `no_shots_left`, which is terminal, so the
 * queue deletes the only copy. Get it wrong in the other and a guest is refused film they
 * have actually got left.
 *
 * The whole camera reads `initialShots - spent - carried`, so these are the numbers that
 * decide whether photographs survive.
 */

/** One session: a queue report arrives, then the arithmetic the dial is drawn from. */
function dial(initial: number, marks: { unreserved: number; spent: number }[]): number {
  let carried = 0;
  let spent = 0;
  for (const mark of marks) {
    spent = mark.spent;
    carried = carriedForward(carried, mark.unreserved, spent);
  }
  return Math.max(0, initial - spent - carried);
}

test("a fresh camera on an empty queue offers the whole roll", () => {
  expect(dial(5, [{ unreserved: 0, spent: 0 }])).toBe(5);
});

test("a shot taken this session costs exactly one, not two", () => {
  // The frame is in `spent` and, once enqueued, in `unreserved` as well.
  expect(dial(5, [{ unreserved: 0, spent: 1 }, { unreserved: 1, spent: 1 }])).toBe(4);
});

test("a backlog from a previous session is subtracted on arrival", () => {
  // The server still says five: those two frames have never reached it.
  expect(dial(5, [{ unreserved: 2, spent: 0 }])).toBe(3);
});

test("a backlog that finally uploads does not hand its shots back", () => {
  // This is the regression. `initialShots` was read before those reservations existed, so
  // an emptied queue must not restore film the guest has already spent.
  expect(dial(5, [{ unreserved: 2, spent: 0 }, { unreserved: 0, spent: 0 }])).toBe(3);
});

test("a backlog and a fresh shot are counted once each", () => {
  expect(
    dial(5, [
      { unreserved: 2, spent: 0 },
      { unreserved: 3, spent: 1 },
      { unreserved: 0, spent: 1 },
    ]),
  ).toBe(2);
});

test("film cannot go negative, however far behind the server is", () => {
  expect(dial(1, [{ unreserved: 4, spent: 0 }])).toBe(0);
});
