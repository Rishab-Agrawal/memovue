import { expect, test } from "@playwright/test";

import {
  finishDateRange,
  formatCountdown,
  formatPrice,
  isWithin,
  priceFor,
  revealAt,
  startDateRange,
} from "@/app/proto/rules";

test.describe("pricing", () => {
  test("the smallest tier is free whatever the shot count", () => {
    expect(priceFor(0, 0)).toBe(0);
    expect(priceFor(0, 5)).toBe(0);
    expect(formatPrice(priceFor(0, 5))).toBe("Free");
  });

  test("price rises with participants and with shots", () => {
    expect(priceFor(3, 3)).toBeGreaterThan(priceFor(2, 3));
    expect(priceFor(3, 4)).toBeGreaterThan(priceFor(3, 3));
  });

  test("prices are round rupee figures with a separator", () => {
    expect(priceFor(4, 3) % 10).toBe(0);
    expect(formatPrice(1299)).toBe("₹1,299");
    expect(formatPrice(199)).toBe("₹199");
  });
});

test.describe("date ranges", () => {
  const now = new Date("2026-09-01T10:00:00Z");

  test("a start date may be up to two years out", () => {
    const range = startDateRange(now);
    expect(isWithin(new Date("2028-08-30T10:00:00Z"), range)).toBe(true);
    expect(isWithin(new Date("2028-09-05T10:00:00Z"), range)).toBe(false);
    expect(isWithin(new Date("2026-08-31T10:00:00Z"), range)).toBe(false);
  });

  test("a finish date may be up to two months after the start", () => {
    const range = finishDateRange(new Date("2026-09-12T18:00:00Z"));
    expect(isWithin(new Date("2026-10-30T18:00:00Z"), range)).toBe(true);
    expect(isWithin(new Date("2026-11-20T18:00:00Z"), range)).toBe(false);
    expect(isWithin(new Date("2026-09-11T18:00:00Z"), range)).toBe(false);
  });
});

test.describe("reveal time", () => {
  const finish = new Date("2026-09-13T23:00:00Z");

  test("during-event films never have a reveal moment", () => {
    expect(revealAt(finish, "during", 12)).toBeNull();
  });

  test("after-event films reveal exactly when the film closes", () => {
    expect(revealAt(finish, "after", 12)?.toISOString()).toBe("2026-09-13T23:00:00.000Z");
  });

  test("a delay is counted in hours from the close", () => {
    expect(revealAt(finish, "delay", 12)?.toISOString()).toBe("2026-09-14T11:00:00.000Z");
  });
});

test.describe("countdown", () => {
  const minute = 60_000;

  test("reads in days, then hours, then minutes", () => {
    expect(formatCountdown(3 * 24 * 60 * minute + 4 * 60 * minute)).toBe("3d 4h left");
    expect(formatCountdown(7 * 60 * minute + 32 * minute)).toBe("7h 32m left");
    expect(formatCountdown(50 * minute)).toBe("50m left");
  });

  test("a finished film says so instead of counting backwards", () => {
    expect(formatCountdown(0)).toBe("Ended");
    expect(formatCountdown(-minute)).toBe("Ended");
  });
});
