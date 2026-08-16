import type { Locator, Page } from "@playwright/test";

/**
 * Everything inside the phone, excluding the prototype's own prev/next bar.
 *
 * The bar shows the current screen's name, and those names deliberately echo the screens
 * they label — "Home — no active films" contains "No active films". Scoping to the screen
 * keeps a test asserting on the product rather than on the scaffolding around it.
 */
export function screen(page: Page): Locator {
  return page.getByTestId("screen");
}
