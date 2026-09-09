import { expect, test } from "@playwright/test";

import {
  acceptsUploads,
  isCapturing,
  isOpen,
  openRollWhere,
  rollPhase,
  takenAtWithin,
  computeRevealAt,
  visiblePhotoWhere,
  UPLOAD_GRACE_HOURS,
  type RollTimings,
  type Viewer,
} from "@/lib/roll-access";

/**
 * The rule a leak would come from.
 *
 * "Can anyone see this photograph" once had a single answer for the whole app: not until
 * revealAt. It now turns on two independent axes — whether the roll is open, and whose photo
 * it is — asked by two different functions, in that order. `isOpen` is the seal and knows
 * nothing about ownership; `visiblePhotoWhere` is ownership and knows nothing about the
 * clock. Both are pinned below, and so is the order.
 */

const HOUR = 3_600_000;
const now = new Date("2026-09-13T12:00:00Z");

function roll(overrides: Partial<RollTimings & { everyoneCanSee: boolean }> = {}) {
  return {
    startsAt: new Date("2026-09-12T18:00:00Z"),
    finishesAt: new Date("2026-09-13T23:00:00Z"),
    revealAt: new Date("2026-09-13T23:00:00Z"),
    revealMode: "AFTER" as const,
    revealedEarly: false,
    everyoneCanSee: false,
    ...overrides,
  };
}

/** Whether the clause `openRollWhere` builds would return this roll. */
function matchesOpenWhere(r: RollTimings, at: Date): boolean {
  return openRollWhere(at).OR.some((arm) =>
    "revealedEarly" in arm
      ? r.revealedEarly
      : "revealMode" in arm
        ? r.revealMode === arm.revealMode
        : r.revealAt.getTime() < arm.revealAt.lt.getTime(),
  );
}

const host: Viewer = { kind: "host" };
const meera: Viewer = { kind: "guest", guestId: "g-meera" };
const arjun: Viewer = { kind: "guest", guestId: "g-arjun" };

const meerasPhoto = { guestId: "g-meera" };
const arjunsPhoto = { guestId: "g-arjun" };

/**
 * Whether the query the app actually runs would return this photograph.
 *
 * The clause is the whole authorisation now. A guest never asks a route for one frame's
 * bytes — the image key carries a random secret, so the URL is the capability, and it is
 * only ever minted for a row this clause returned. What it excludes is unreachable.
 */
function admits(everyoneCanSee: boolean, viewer: Viewer, photo: { guestId: string }): boolean {
  const where = visiblePhotoWhere({ id: "r1", everyoneCanSee }, viewer);
  expect(where.rollId).toBe("r1");
  // Never the reserved-but-unconfirmed rows, whichever axis is in play.
  expect(where.status).toBe("READY");
  return where.guestId === undefined || where.guestId === photo.guestId;
}

test.describe("the seal", () => {
  test("before the reveal nothing is legible, including to the host", () => {
    // Asked before ownership ever is: a sealed roll returns an empty grid whoever is looking,
    // so there is nothing here but the clock.
    expect(isOpen(roll(), now)).toBe(false);
  });

  test("not even the person who took the photo", () => {
    // The one that surprises people. A guest cannot review their own shot early — that is
    // what makes the disposable camera a disposable camera. Ownership does not enter into it,
    // which is exactly why this asserts nothing about ownership.
    expect(isOpen(roll({ everyoneCanSee: true }), now)).toBe(false);
  });

  test("a DURING roll is open from the moment it exists", () => {
    expect(isOpen(roll({ revealMode: "DURING" }), now)).toBe(true);
  });

  test("revealing early overrides a future revealAt", () => {
    expect(isOpen(roll({ revealedEarly: true }), now)).toBe(true);
  });

  test("the seal lifts on time", () => {
    const r = roll();
    expect(isOpen(r, new Date("2026-09-13T22:59:59Z"))).toBe(false);
    expect(isOpen(r, new Date("2026-09-13T23:00:00Z"))).toBe(true);
  });

  test("the query form agrees with the function, roll for roll", () => {
    /*
      The digest counts open albums with a `where` rather than by loading rolls and asking
      `isOpen`, so the rule is written twice and only this stops the two drifting. It caught
      the version that was only `revealAt < now`, which silently omitted every DURING roll and
      every early reveal from the one number that says whether sealing albums was worth doing.
    */
    for (const r of [
      roll(),
      roll({ revealMode: "DURING" }),
      roll({ revealedEarly: true }),
      roll({ revealAt: new Date("2026-09-13T11:59:59Z") }),
      roll({ revealMode: "DURING", revealAt: new Date("2026-09-14T23:00:00Z") }),
    ]) {
      expect(matchesOpenWhere(r, now)).toBe(isOpen(r, now));
    }
  });
});

test.describe("ownership, once open", () => {
  test("with visibility off everyone gets their own frames and nobody else's", () => {
    expect(admits(false, meera, meerasPhoto)).toBe(true);
    expect(admits(false, meera, arjunsPhoto)).toBe(false);
    expect(admits(false, arjun, arjunsPhoto)).toBe(true);
    expect(admits(false, arjun, meerasPhoto)).toBe(false);
  });

  test("with visibility on a guest gets everything", () => {
    expect(admits(true, meera, arjunsPhoto)).toBe(true);
    expect(admits(true, arjun, meerasPhoto)).toBe(true);
  });

  test("the host gets every photo either way", () => {
    expect(admits(false, host, arjunsPhoto)).toBe(true);
    expect(admits(true, host, arjunsPhoto)).toBe(true);
  });

  test("a guest is pinned to themselves, not merely defaulted to themselves", () => {
    // The photos route spreads `?guestId=` on top of this clause so a guest can narrow the
    // grid to one photographer. This is what stops the same param widening it: with
    // visibility off the clause already names them, and an intersection cannot reach further.
    expect(visiblePhotoWhere({ id: "r1", everyoneCanSee: false }, meera).guestId).toBe("g-meera");
    expect(visiblePhotoWhere({ id: "r1", everyoneCanSee: true }, meera).guestId).toBeUndefined();
  });

  test("visibility never unseals a closed roll", () => {
    // everyoneCanSee is about ownership, not about the clock. Getting the order backwards
    // would publish every photo of every unrevealed roll — so callers ask `isOpen` first and
    // this clause is never reached on a sealed roll.
    expect(isOpen(roll({ everyoneCanSee: true }), now)).toBe(false);
  });
});

test.describe("phase", () => {
  test("walks scheduled, capturing, closed, revealed", () => {
    const r = roll({ revealAt: new Date("2026-09-14T11:00:00Z"), revealMode: "DELAY" });
    expect(rollPhase(r, new Date("2026-09-12T09:00:00Z"))).toBe("scheduled");
    expect(rollPhase(r, new Date("2026-09-13T09:00:00Z"))).toBe("capturing");
    // Shooting is over but the photos have not opened yet — the state the old model, which
    // folded finishing into revealing, could not represent.
    expect(rollPhase(r, new Date("2026-09-14T02:00:00Z"))).toBe("closed");
    expect(rollPhase(r, new Date("2026-09-14T12:00:00Z"))).toBe("revealed");
  });
});

test.describe("computeRevealAt", () => {
  const finishes = new Date("2026-09-13T23:00:00Z");

  test("AFTER reveals when the roll closes", () => {
    expect(computeRevealAt(finishes, "AFTER", 12).getTime()).toBe(finishes.getTime());
  });

  test("DELAY adds hours to the close", () => {
    expect(computeRevealAt(finishes, "DELAY", 12).getTime()).toBe(finishes.getTime() + 12 * HOUR);
  });

  test("DURING stores the close but never gates on it", () => {
    expect(computeRevealAt(finishes, "DURING", 12).getTime()).toBe(finishes.getTime());
  });
});

/**
 * The gap between taking a photograph and uploading it.
 *
 * A guest shot ten frames near the end of an event, the queue drained after it closed, the
 * reserve route refused them as `not_shooting`, and the client — correctly reading that as
 * permanent — deleted the only copy of each one. Nothing in the suite covered the difference
 * between "may shoot" and "may finish sending what was already shot", because until then
 * there was no difference.
 */
test.describe("uploads outlive the shutter", () => {
  const roll = {
    startsAt: new Date("2026-08-26T18:30:00Z"),
    finishesAt: new Date("2026-08-26T19:30:00Z"),
    revealAt: new Date("2026-08-26T19:30:00Z"),
    revealMode: "AFTER" as const,
    revealedEarly: false,
  };

  test("the shutter still closes exactly on time", () => {
    expect(isCapturing(roll, new Date("2026-08-26T19:29:59Z"))).toBe(true);
    expect(isCapturing(roll, new Date("2026-08-26T19:30:01Z"))).toBe(false);
  });

  test("a photo taken at the close may still be uploaded after it", () => {
    // The exact case that lost them: shot at 19:29, drained at 19:31.
    expect(acceptsUploads(roll, new Date("2026-08-26T19:31:00Z"))).toBe(true);
    // And the next morning, off the venue's wifi and back on a phone network.
    expect(acceptsUploads(roll, new Date("2026-08-27T09:00:00Z"))).toBe(true);
  });

  test("but not indefinitely, and not before the roll opens", () => {
    expect(acceptsUploads(roll, new Date("2026-08-26T18:29:00Z"))).toBe(false);
    const pastGrace = new Date(roll.finishesAt.getTime() + (UPLOAD_GRACE_HOURS + 1) * 3_600_000);
    expect(acceptsUploads(roll, pastGrace)).toBe(false);
  });

  /** The grace window must never be a way to read the album early. */
  test("accepting uploads says nothing about the seal", () => {
    const sealed = { ...roll, revealAt: new Date("2026-08-27T12:00:00Z"), revealMode: "DELAY" as const };
    const during = new Date("2026-08-26T19:31:00Z");
    expect(acceptsUploads(sealed, during)).toBe(true);
    expect(isOpen(sealed, during)).toBe(false);
  });
});

/**
 * When a photograph says it was taken.
 *
 * The row's own timestamp is written when the shot is reserved, which is when the bytes
 * arrive rather than when the shutter fired — so an evening spent out of signal was filed
 * under the moment the phone found wifi, and with the upload grace that can be the next day.
 * The queue has always known the real moment; it just never sent it.
 *
 * It arrives from a device whose clock belongs to the user, so it is believed only within the
 * window it could possibly describe.
 */
test.describe("when a photograph says it was taken", () => {
  const roll = {
    startsAt: new Date("2026-08-26T18:30:00Z"),
    finishesAt: new Date("2026-08-26T23:30:00Z"),
    revealAt: new Date("2026-08-26T23:30:00Z"),
    revealMode: "AFTER" as const,
    revealedEarly: false,
  };

  test("a time inside the event is taken at its word", () => {
    const during = new Date("2026-08-26T21:14:00Z");
    expect(takenAtWithin(during, roll).toISOString()).toBe(during.toISOString());
  });

  /** The case the whole change exists for: shot at nine, uploaded from the taxi at one. */
  test("uploading late does not move when it was taken", () => {
    const shutter = new Date("2026-08-26T21:00:00Z");
    expect(takenAtWithin(shutter, roll).getTime()).toBe(shutter.getTime());
  });

  test("a clock hours out of true cannot leave the event", () => {
    expect(takenAtWithin(new Date("2026-08-20T12:00:00Z"), roll)).toEqual(roll.startsAt);
    expect(takenAtWithin(new Date("2027-01-01T00:00:00Z"), roll)).toEqual(roll.finishesAt);
  });

  test("nonsense falls back rather than throwing", () => {
    expect(takenAtWithin(new Date("not a date"), roll)).toEqual(roll.finishesAt);
  });
});
