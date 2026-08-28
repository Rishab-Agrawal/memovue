import { expect, test } from "@playwright/test";

import {
  acceptsUploads,
  canViewPhoto,
  isCapturing,
  isOpen,
  rollPhase,
  computeRevealAt,
  visiblePhotoWhere,
  UPLOAD_GRACE_HOURS,
  type Viewer,
} from "@/lib/roll-access";

/**
 * The rule a leak would come from.
 *
 * Until now "can anyone see this photograph" had one answer for the whole app: not until
 * revealAt. It now depends on two independent axes — whether the roll is open, and whose
 * photo it is — so these tests pin both, and pin them against each other.
 */

const HOUR = 3_600_000;
const now = new Date("2026-09-13T12:00:00Z");

function roll(overrides: Partial<Parameters<typeof canViewPhoto>[0]> = {}) {
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

const host: Viewer = { kind: "host" };
const meera: Viewer = { kind: "guest", guestId: "g-meera" };
const arjun: Viewer = { kind: "guest", guestId: "g-arjun" };

const meerasPhoto = { guestId: "g-meera" };
const arjunsPhoto = { guestId: "g-arjun" };

test.describe("the seal", () => {
  test("before the reveal nobody sees anything, including the host", () => {
    const r = roll();
    expect(isOpen(r, now)).toBe(false);
    expect(canViewPhoto(r, meerasPhoto, host, now)).toBe(false);
  });

  test("not even the person who took the photo", () => {
    // The one that surprises people. A guest cannot review their own shot early — that is
    // what makes the disposable camera a disposable camera.
    expect(canViewPhoto(roll(), meerasPhoto, meera, now)).toBe(false);
  });

  test("a DURING roll is open from the moment it exists", () => {
    const r = roll({ revealMode: "DURING" });
    expect(isOpen(r, now)).toBe(true);
    expect(canViewPhoto(r, meerasPhoto, meera, now)).toBe(true);
  });

  test("revealing early overrides a future revealAt", () => {
    const r = roll({ revealedEarly: true });
    expect(isOpen(r, now)).toBe(true);
    expect(canViewPhoto(r, meerasPhoto, host, now)).toBe(true);
  });

  test("the seal lifts on time", () => {
    const r = roll();
    expect(isOpen(r, new Date("2026-09-13T22:59:59Z"))).toBe(false);
    expect(isOpen(r, new Date("2026-09-13T23:00:00Z"))).toBe(true);
  });
});

test.describe("visibility, once open", () => {
  const open = new Date("2026-09-14T09:00:00Z");

  test("with visibility off a guest sees their own and nobody else's", () => {
    const r = roll({ everyoneCanSee: false });
    expect(canViewPhoto(r, meerasPhoto, meera, open)).toBe(true);
    expect(canViewPhoto(r, arjunsPhoto, meera, open)).toBe(false);
  });

  test("with visibility on a guest sees everything", () => {
    const r = roll({ everyoneCanSee: true });
    expect(canViewPhoto(r, arjunsPhoto, meera, open)).toBe(true);
  });

  test("the host sees every photo in an open roll either way", () => {
    expect(canViewPhoto(roll({ everyoneCanSee: false }), arjunsPhoto, host, open)).toBe(true);
    expect(canViewPhoto(roll({ everyoneCanSee: true }), arjunsPhoto, host, open)).toBe(true);
  });

  test("visibility never unseals a closed roll", () => {
    // everyoneCanSee is about ownership, not about the clock. Getting this backwards would
    // publish every photo of every unrevealed roll.
    const r = roll({ everyoneCanSee: true });
    expect(canViewPhoto(r, arjunsPhoto, meera, now)).toBe(false);
  });
});

test.describe("the list query agrees with the single-photo guard", () => {
  // The realistic failure is not writing the rule wrong once. It is these two paths to the
  // same decision drifting apart later.
  const open = new Date("2026-09-14T09:00:00Z");
  const photos = [meerasPhoto, arjunsPhoto];

  for (const everyoneCanSee of [true, false]) {
    for (const viewer of [host, meera, arjun]) {
      test(`everyoneCanSee=${everyoneCanSee}, viewer=${viewer.kind}:${
        viewer.kind === "guest" ? viewer.guestId : "-"
      }`, () => {
        const r = roll({ everyoneCanSee });
        const where = visiblePhotoWhere({ id: "r1", everyoneCanSee }, viewer);

        for (const photo of photos) {
          // What the query would return for this photo...
          const queryAllows = where.guestId === undefined || where.guestId === photo.guestId;
          // ...must match what the guard says about it.
          expect(queryAllows).toBe(canViewPhoto(r, photo, viewer, open));
        }
      });
    }
  }
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
