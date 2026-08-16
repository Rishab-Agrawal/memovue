import { expect, test } from "@playwright/test";

import { screen } from "./helpers";

test("before the reveal nothing is downloadable and every tile is sealed", async ({ page }) => {
  await page.goto("/proto/film");

  // Typographic apostrophe in the copy, so the assertion stops before it.
  await expect(screen(page).getByText(/Only the host can see everyone/)).toBeVisible();
  await expect(screen(page).getByLabel("Download album")).toHaveAttribute("aria-disabled", "true");
  await expect(screen(page).getByText(/Reveals in/).first()).toBeVisible();
  await expect(screen(page).getByText("Photos available until Oct 13")).toBeVisible();
});

test("after the reveal the camera gives way to Send and Save", async ({ page }) => {
  await page.goto("/proto/film?v=revealed");

  await expect(screen(page).getByRole("link", { name: "Send" })).toBeVisible();
  await expect(screen(page).getByRole("link", { name: "Save" })).toBeVisible();
  await expect(screen(page).getByText("Ended")).toBeVisible();
  await expect(screen(page).getByText(/Reveals in/)).toHaveCount(0);
});

test("People opens a roster rather than an upsell", async ({ page }) => {
  await page.goto("/proto/film");
  await screen(page).getByRole("link", { name: /People/ }).click();

  await expect(page).toHaveURL(/\/proto\/film\/people/);

  // Scoped to the roster: "Meera" also credits two of the photos behind the sheet.
  const roster = screen(page).getByRole("listitem");
  await expect(roster).toHaveCount(2);
  await expect(roster.filter({ hasText: "Meera" })).toContainText("of 24 shots used");

  await expect(screen(page).getByText(/Add Participants/i)).toHaveCount(0);
});

test("the QR sheet can be saved", async ({ page }) => {
  await page.goto("/proto/film/invite");

  await expect(
    screen(page).getByRole("heading", { name: "Invite guests to your film." }),
  ).toBeVisible();

  await screen(page).getByRole("link", { name: "Save QR image" }).click();
  await expect(screen(page).getByText("QR code saved to your photos!")).toBeVisible();
});
