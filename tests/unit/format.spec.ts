import { expect, test } from "@playwright/test";

import {
  formatDateTime,
  formatDuration,
  fromWall,
  monthGrid,
  sameWallDay,
  startOfWallDay,
  toWall,
  withWallDay,
  withWallTime,
} from "@/lib/format";
import {
  MIN_ROLL_MINUTES,
  clampFinish,
  earliestFinish,
  finishDateRange,
  isWithin,
  startDateRange,
} from "@/lib/roll-config";

/**
 * The picker and the formatter have to agree on what "6 PM" means. When they didn't, a host
 * in India picking 6:00 PM got a roll that opened at 11:30 PM.
 */
test.describe("wall clock", () => {
  test("a picked time reads back as the same time", () => {
    const instant = fromWall(2026, 8, 19, 18, 0); // 19 Sep 2026, 6:00 pm IST
    expect(formatDateTime(instant)).toBe("19 Sep 2026 at 6:00 pm");

    const wall = toWall(instant);
    expect(wall.hour).toBe(18);
    expect(wall.minute).toBe(0);
    expect(wall.day).toBe(19);
  });

  test("the instant is genuinely offset, not just relabelled", () => {
    // 6:00 pm in Kolkata is 12:30 UTC. If these matched, the zone was being ignored.
    expect(fromWall(2026, 8, 19, 18, 0).toISOString()).toBe("2026-09-19T12:30:00.000Z");
  });

  test("late evening does not roll over to the next day", () => {
    // The failure a UTC calendar produces: 11pm IST is already tomorrow in UTC, so the
    // selected date jumps a day for anyone shooting after 6:30pm.
    const lateNight = fromWall(2026, 8, 19, 23, 30);
    expect(toWall(lateNight).day).toBe(19);
    expect(sameWallDay(lateNight, fromWall(2026, 8, 19, 9, 0))).toBe(true);
  });

  test("startOfWallDay lands on local midnight", () => {
    expect(startOfWallDay(fromWall(2026, 8, 19, 23, 30)).toISOString()).toBe(
      "2026-09-18T18:30:00.000Z",
    );
  });

  test("month grids know their shape", () => {
    // September 2026 starts on a Tuesday and has 30 days.
    expect(monthGrid(2026, 8)).toEqual({ firstWeekday: 2, days: 30 });
    // February in a leap year.
    expect(monthGrid(2028, 1).days).toBe(29);
  });
});

/**
 * What the two date pickers do when you tap them.
 *
 * These shipped built out of `setUTCHours` on the underlying instant, which reads like "keep
 * the day, change the time" and is not. Midnight in Kolkata is 18:30 UTC on the day *before*,
 * so writing a UTC hour onto a freshly picked date walked it backwards: tapping the 20th
 * selected the 19th, for every time of day earlier than 6:30 pm. The same mix-up fed the time
 * wheel UTC hours while the button beside it displayed IST, so a host who chose 8:00 pm got a
 * roll that opened at 1:30 am the next morning.
 */
test.describe("editing a picked date", () => {
  test("tapping a day keeps the time and lands on the day tapped", () => {
    const current = fromWall(2026, 8, 19, 18, 0); // 19 Sep, 6:00 pm
    const tapped = fromWall(2026, 8, 20); // the host taps the 20th

    const next = withWallDay(current, tapped);

    expect(toWall(next).day).toBe(20);
    expect(formatDateTime(next)).toBe("20 Sep 2026 at 6:00 pm");
  });

  test("no time of day walks the date backwards", () => {
    const tapped = fromWall(2026, 8, 20);

    // Every hour, including the ones either side of the 18:30 boundary that caused this.
    for (let hour = 0; hour < 24; hour += 1) {
      const current = fromWall(2026, 8, 19, hour, 45);
      const next = withWallDay(current, tapped);

      expect(toWall(next).day, `at ${hour}:45`).toBe(20);
      expect(toWall(next).hour, `at ${hour}:45`).toBe(hour);
      expect(toWall(next).minute, `at ${hour}:45`).toBe(45);
    }
  });

  test("choosing a time keeps the day and sets the time chosen", () => {
    const current = fromWall(2026, 8, 19, 18, 0);
    const next = withWallTime(current, 20, 30);

    expect(formatDateTime(next)).toBe("19 Sep 2026 at 8:30 pm");
  });

  test("a time before 5:30 am stays on the day the host is looking at", () => {
    // The mirror of the other boundary: early-morning IST is still the previous UTC day.
    const current = fromWall(2026, 8, 19, 18, 0);
    const next = withWallTime(current, 2, 15);

    expect(toWall(next).day).toBe(19);
    expect(formatDateTime(next)).toBe("19 Sep 2026 at 2:15 am");
  });

  test("what the wheel is handed is what it hands back", () => {
    // The picker seeds itself from `toWall(value)` and returns through `withWallTime`, so
    // opening it and pressing Done without touching anything must be a no-op.
    for (const hour of [0, 5, 12, 18, 23]) {
      for (const minute of [0, 30, 59]) {
        const value = fromWall(2026, 8, 19, hour, minute);
        const wall = toWall(value);

        expect(withWallTime(value, wall.hour, wall.minute).getTime()).toBe(value.getTime());
      }
    }
  });

  test("moving day then time composes to exactly what was asked for", () => {
    const start = fromWall(2026, 8, 19, 18, 0);
    const moved = withWallTime(withWallDay(start, fromWall(2026, 9, 3)), 9, 15);

    expect(formatDateTime(moved)).toBe("3 Oct 2026 at 9:15 am");
  });
});

test.describe("scheduling limits", () => {
  const now = fromWall(2026, 8, 13, 12, 0);

  test("a start date may be up to two years out", () => {
    const range = startDateRange(now);
    expect(isWithin(fromWall(2028, 8, 12, 10, 0), range)).toBe(true);
    expect(isWithin(fromWall(2028, 8, 14, 10, 0), range)).toBe(false);
    expect(isWithin(fromWall(2026, 8, 12, 10, 0), range)).toBe(false);
  });

  test("a roll may run for at most two months", () => {
    const range = finishDateRange(fromWall(2026, 8, 19, 18, 0));
    expect(isWithin(fromWall(2026, 9, 30, 18, 0), range)).toBe(true);
    expect(isWithin(fromWall(2026, 10, 25, 18, 0), range)).toBe(false);
    expect(isWithin(fromWall(2026, 8, 18, 18, 0), range)).toBe(false);
  });

  test("a roll starting today is allowed", () => {
    expect(isWithin(now, startDateRange(now))).toBe(true);
  });
});

/**
 * A roll has to last half an hour.
 *
 * The date and the time are picked on separate controls, so "the finish must come after the
 * start" was satisfied by a 3am start and a 2am finish on the same day: both screens looked
 * reasonable and the roll closed an hour before it opened.
 */
test.describe("the shortest a roll may run", () => {
  test("the finish floor is half an hour after the start", () => {
    expect(MIN_ROLL_MINUTES).toBe(30);
    expect(formatDateTime(earliestFinish(fromWall(2026, 8, 19, 3, 0)))).toBe(
      "19 Sep 2026 at 3:30 am",
    );
  });

  test("an earlier time on the start's own day is not a legal finish", () => {
    const startsAt = fromWall(2026, 8, 19, 3, 0);
    const floor = earliestFinish(startsAt);

    // The case the host hit: 3am start, 2am finish, same day.
    expect(fromWall(2026, 8, 19, 2, 0).getTime() < floor.getTime()).toBe(true);
    expect(fromWall(2026, 8, 19, 3, 29).getTime() < floor.getTime()).toBe(true);
    expect(fromWall(2026, 8, 19, 3, 30).getTime() < floor.getTime()).toBe(false);
  });

  test("a start in the last half hour of a day cannot close on that day", () => {
    // 23:50 leaves no legal finish before midnight, so the day itself is off the calendar.
    const range = finishDateRange(fromWall(2026, 8, 19, 23, 50));
    expect(isWithin(fromWall(2026, 8, 19, 23, 59), range)).toBe(false);
    expect(isWithin(fromWall(2026, 8, 20, 0, 20), range)).toBe(true);
  });

  test("a start with room to spare still offers its own day", () => {
    const range = finishDateRange(fromWall(2026, 8, 19, 3, 0));
    expect(isWithin(fromWall(2026, 8, 19, 23, 0), range)).toBe(true);
  });

  test("moving the start forward pushes a finish that no longer fits", () => {
    const finishesAt = fromWall(2026, 8, 19, 20, 0);
    const startsAt = fromWall(2026, 8, 21, 9, 0); // now after the finish

    expect(formatDateTime(clampFinish(startsAt, finishesAt))).toBe("21 Sep 2026 at 9:30 am");
  });

  test("a finish that already fits is left exactly where the host put it", () => {
    const startsAt = fromWall(2026, 8, 19, 18, 0);
    const finishesAt = fromWall(2026, 8, 20, 23, 0);

    expect(clampFinish(startsAt, finishesAt).getTime()).toBe(finishesAt.getTime());
    // Exactly on the floor counts as fitting.
    const floor = earliestFinish(startsAt);
    expect(clampFinish(startsAt, floor).getTime()).toBe(floor.getTime());
  });

  test("moving the start back pulls a finish that overshoots two months", () => {
    const finishesAt = fromWall(2026, 9, 30, 21, 0); // 30 Oct
    const startsAt = fromWall(2026, 7, 1, 9, 0); // moved back to 1 Aug

    // Pulled onto the last legal day, keeping the time of day that was chosen.
    expect(formatDateTime(clampFinish(startsAt, finishesAt))).toBe("1 Oct 2026 at 9:00 pm");
  });

  test("whatever clampFinish returns is something the wizard would accept", () => {
    const startsAt = fromWall(2026, 8, 19, 18, 0);

    for (const finishesAt of [
      fromWall(2026, 8, 19, 0, 0),
      fromWall(2026, 8, 19, 18, 10),
      fromWall(2026, 8, 20, 23, 0),
      fromWall(2027, 2, 1, 12, 0),
    ]) {
      const clamped = clampFinish(startsAt, finishesAt);
      expect(clamped.getTime()).toBeGreaterThanOrEqual(earliestFinish(startsAt).getTime());
      expect(isWithin(clamped, finishDateRange(startsAt))).toBe(true);
    }
  });
});

test.describe("durations", () => {
  const minute = 60_000;

  test("reads in days, then hours, then minutes, with no trailing word", () => {
    expect(formatDuration(3 * 24 * 60 * minute + 4 * 60 * minute)).toBe("3d 4h");
    expect(formatDuration(7 * 60 * minute + 32 * minute)).toBe("7h 32m");
    expect(formatDuration(50 * minute)).toBe("50m");
    expect(formatDuration(0)).toBe("Ended");
  });
});
