import { expect, test } from "@playwright/test";

import { screen } from "./helpers";

test("the empty home offers the only two ways forward", async ({ page }) => {
  await page.goto("/proto/home?v=empty");

  await expect(screen(page).getByText("No active rolls")).toBeVisible();
  await expect(screen(page).getByRole("link", { name: /Create roll/ })).toHaveAttribute(
    "href",
    "/proto/new/name",
  );
  await expect(page.getByText("Tapes")).toHaveCount(0);
});

test("an active roll shows its countdown and opens the roll", async ({ page }) => {
  await page.goto("/proto/home");

  await expect(screen(page).getByText("Aarav & Diya's Wedding")).toBeVisible();
  await expect(screen(page).getByText(/left$/)).toBeVisible();

  await screen(page).getByText("Aarav & Diya's Wedding").click();
  await expect(page).toHaveURL(/\/proto\/roll/);
});
