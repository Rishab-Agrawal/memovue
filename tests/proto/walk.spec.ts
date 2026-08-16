import { expect, test } from "@playwright/test";

import { SCREENS } from "@/app/proto/screens";

test("the index links every registered screen", async ({ page }) => {
  await page.goto("/proto");
  for (const screen of SCREENS) {
    await expect(page.getByRole("link", { name: screen.name, exact: true })).toBeVisible();
  }
});

for (const screen of SCREENS) {
  test(`${screen.name} renders`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(screen.path);
    expect(response?.status()).toBe(200);

    await expect(page.getByTestId("screen-name")).toHaveText(screen.name);

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
    expect(errors).toEqual([]);
  });
}
