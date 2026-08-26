import { expect, test } from "@playwright/test";

import { retentionAction, WARN_BEFORE_DAYS } from "@/lib/roll-access";

/**
 * What the nightly sweep decides, without a database or a bucket.
 *
 * The effects are not interesting to test — deleting a row deletes a row. What is worth
 * pinning down is the boundary either side of the date printed on every roll, and the promise
 * that a host is emailed once rather than every night for a week.
 */

const DAY = 86_400_000;
const NOW = new Date("2026-09-01T02:00:00Z");
const at = (days: number) => new Date(NOW.getTime() + days * DAY);

test.describe("what happens to a roll tonight", () => {
  test("leaves a roll that is nowhere near its date", () => {
    expect(retentionAction({ keptUntil: at(30), warnedAt: null }, NOW)).toBe("leave");
  });

  test("warns exactly once inside the warning window", () => {
    const roll = { keptUntil: at(3), warnedAt: null };
    expect(retentionAction(roll, NOW)).toBe("warn");

    // Tomorrow, with the send recorded, it must stay quiet.
    expect(retentionAction({ ...roll, warnedAt: NOW }, at(1))).toBe("leave");
  });

  test("the warning window opens at the boundary, not a day either side", () => {
    expect(retentionAction({ keptUntil: at(WARN_BEFORE_DAYS), warnedAt: null }, NOW)).toBe("warn");
    expect(
      retentionAction({ keptUntil: at(WARN_BEFORE_DAYS + 0.01), warnedAt: null }, NOW),
    ).toBe("leave");
  });

  /**
   * The whole point. A roll that has reached the date printed on it goes, and it goes whether
   * or not the warning was ever sent — a missed cron night must not buy a roll another week.
   */
  test("purges on and after the date, warned or not", () => {
    expect(retentionAction({ keptUntil: NOW, warnedAt: null }, NOW)).toBe("purge");
    expect(retentionAction({ keptUntil: at(-1), warnedAt: null }, NOW)).toBe("purge");
    expect(retentionAction({ keptUntil: at(-90), warnedAt: at(-97) }, NOW)).toBe("purge");
  });

  /**
   * A roll created after the sweep started running has `warnedAt` set from an earlier life
   * only if it was warned. An unwarned roll that blows straight past its date — because the
   * job was off for a fortnight — still purges rather than falling into the warn branch.
   */
  test("a long outage does not leave rolls stuck in the warn branch", () => {
    expect(retentionAction({ keptUntil: at(-14), warnedAt: null }, NOW)).toBe("purge");
  });
});
