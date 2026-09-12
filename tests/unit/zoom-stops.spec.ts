import { expect, test } from "@playwright/test";

import { zoomStops } from "../../src/components/guest/CameraView";

/**
 * What "2×" means on a camera that does not agree with the next one about units.
 *
 * Phones report their zoom range three different ways, and the wrong reading of it is not a
 * cosmetic bug: on an ultra-wide phone, treating `min` as 1× makes the 1× button the 0.5×
 * lens and the 2× button 1×, so every photograph a guest takes is a stop wider than the one
 * they framed.
 */

test("plain range: 1× and 2× are what they say", () => {
  expect(zoomStops({ min: 1, max: 8 })).toEqual({ one: 1, two: 2 });
});

test("ultra-wide: 1× is 1×, not the widest lens", () => {
  expect(zoomStops({ min: 0.5, max: 8 })).toEqual({ one: 1, two: 2 });
});

test("hundredths: the scale is the camera's, not ours", () => {
  expect(zoomStops({ min: 100, max: 800 })).toEqual({ one: 100, two: 200 });
});

test("no 2× to reach, no control", () => {
  expect(zoomStops({ min: 1, max: 1 })).toBeNull();
  expect(zoomStops({ min: 1, max: 1.5 })).toBeNull();
  expect(zoomStops(undefined)).toBeNull();
});
