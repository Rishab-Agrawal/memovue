import { expect, test } from "@playwright/test";

import { screen } from "./helpers";

test("roll settings drops participants and shots, and keeps the dates", async ({ page }) => {
  await page.goto("/proto/roll/settings");

  await expect(screen(page).getByText("Name & Cover")).toBeVisible();
  await expect(screen(page).getByText("Start date")).toBeVisible();
  await expect(screen(page).getByText("Ending date")).toBeVisible();
  await expect(screen(page).getByText("Reveal time")).toBeVisible();

  await expect(screen(page).getByText("Participants")).toHaveCount(0);
  await expect(screen(page).getByText("Shots per person")).toHaveCount(0);
});

test("the roll settings rows show the roll's current configuration", async ({ page }) => {
  await page.goto("/proto/roll/settings");

  await expect(screen(page).getByText("Sep 12, 2026 at 6:00 PM")).toBeVisible();
  await expect(screen(page).getByText("Sep 13, 2026 at 11:00 PM")).toBeVisible();
});

test("account settings drops Website and the discount section", async ({ page }) => {
  await page.goto("/proto/account");

  await expect(screen(page).getByText("Instagram")).toBeVisible();
  await expect(screen(page).getByText("Contact Support")).toBeVisible();

  await expect(screen(page).getByText("Website")).toHaveCount(0);
  await expect(screen(page).getByText("Partner")).toHaveCount(0);
  await expect(screen(page).getByText(/discount code/i)).toHaveCount(0);
});

test("the delete-account dialog no longer mentions tapes", async ({ page }) => {
  await page.goto("/proto/account?v=delete");

  await expect(screen(page).getByText("Delete Account?")).toBeVisible();
  await expect(screen(page).getByText(/participation in other events/)).toBeVisible();
  await expect(screen(page).getByText(/tapes/i)).toHaveCount(0);
});
