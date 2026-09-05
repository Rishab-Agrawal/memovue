import { expect, test } from "@playwright/test";

import { fingerprint } from "@/instrumentation";
import { wallDate, wallDateRange } from "@/lib/format";
import { shouldAlert } from "@/lib/ratelimit";

/**
 * The three pieces of instrumentation that are logic rather than plumbing.
 *
 * None needs a database, a browser or a bot token, which is the point. Each is the sort of
 * thing only discovered to be wrong months later, from a number that was quietly meaningless
 * or an alarm that quietly never rang.
 */

test.describe("the reporting day", () => {
  test("puts an Indian evening under the date it was actually held on", () => {
    // 01:30 IST on the 6th is 20:00 UTC on the 5th. A UTC bucket files a wedding that ran past
    // midnight under the day before, and one evening's scans land under two different dates.
    expect(wallDate(new Date("2026-09-05T20:00:00Z"))).toBe("2026-09-06");
    // 05:00 IST is still the small hours of that same night, not the next morning.
    expect(wallDate(new Date("2026-09-05T23:30:00Z"))).toBe("2026-09-06");
    // And the ordinary case: mid-afternoon in India is the day it says it is.
    expect(wallDate(new Date("2026-09-05T09:00:00Z"))).toBe("2026-09-05");
  });

  test("covers exactly the twenty-four hours it names, with no gap and no overlap", () => {
    const { from, to } = wallDateRange("2026-09-05");

    // Midnight in Kolkata, which is 18:30 the previous day in UTC.
    expect(from.toISOString()).toBe("2026-09-04T18:30:00.000Z");
    expect(to.getTime() - from.getTime()).toBe(86_400_000);

    expect(wallDate(from)).toBe("2026-09-05");
    expect(wallDate(new Date(to.getTime() - 1))).toBe("2026-09-05");
    expect(wallDate(to)).toBe("2026-09-06");
  });

  test("pads, so days sort and compare as the strings the column stores", () => {
    expect(wallDate(new Date("2026-01-02T06:00:00Z"))).toBe("2026-01-02");
  });
});

/**
 * One test, because both halves read the same process-wide buckets and splitting them would
 * make each assertion depend on whether the runner had given them the same worker.
 */
test("an alert is announced once, and the hour has a ceiling", () => {
  expect(shouldAlert("boom")).toBe(true);
  expect(shouldAlert("boom")).toBe(false);
  expect(shouldAlert("boom")).toBe(false);
  // A different fault is not the same fault.
  expect(shouldAlert("other")).toBe(true);

  // Distinct keys, so only the ceiling can refuse any of them — and two of the twenty are
  // already spent above. Without this, one crashing page is a thousand messages.
  const sent = Array.from({ length: 40 }, (_, index) => shouldAlert(`flood-${index}`)).filter(
    Boolean,
  ).length;

  expect(sent).toBe(18);
});

test.describe("the error fingerprint", () => {
  test("is the route, not the URL every guest arrived by", () => {
    expect(fingerprint("/join/[code]", "boom")).toBe(fingerprint("/join/[code]", "boom"));
    expect(fingerprint("/join/[code]", "boom")).not.toBe(fingerprint("/e/[code]", "boom"));
  });

  test("keeps a stack out of the key, which would make every crash unique", () => {
    const withStack = "boom\n    at Object.<anonymous> (/app/src/lib/rolls.ts:12:9)";
    expect(fingerprint("/rolls", withStack)).toBe(fingerprint("/rolls", "boom"));
  });
});
