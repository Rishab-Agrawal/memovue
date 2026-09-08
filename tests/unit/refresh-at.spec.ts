import { expect, test } from "@playwright/test";

import { refreshDelay } from "@/components/roll/RefreshAt";

/**
 * The screen that refreshes itself, and the two ways that is a bill rather than a feature.
 *
 * A moment in the past would fire at once on a screen that has already rendered past it, and
 * anything beyond `setTimeout`'s twenty-five-day ceiling overflows and also fires at once —
 * and since the refresh re-renders the component that set the timer, either one is a loop
 * hitting the server as fast as it can answer. Both have to be nothing, not a small number.
 */
const NOW = Date.UTC(2026, 8, 8, 12, 0, 0);

test("a reveal still to come is waited for, just past the instant", () => {
  expect(refreshDelay(NOW + 90_000, NOW)).toBe(91_000);
});

test("a reveal already past arms nothing", () => {
  expect(refreshDelay(NOW - 1, NOW)).toBeNull();
  expect(refreshDelay(NOW, NOW)).toBeNull();
});

test("a reveal further off than a day arms nothing", () => {
  // The last moment worth waiting for, and the first one that is not.
  expect(refreshDelay(NOW + 86_400_000, NOW)).toBe(86_401_000);
  expect(refreshDelay(NOW + 86_400_001, NOW)).toBeNull();
  // Comfortably past the overflow, which is where a delay becomes an immediate callback.
  expect(refreshDelay(NOW + 40 * 86_400_000, NOW)).toBeNull();
});
