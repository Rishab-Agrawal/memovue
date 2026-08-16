import { expect, test } from "@playwright/test";

import { screen } from "./helpers";

test("the smallest tier is free and price moves with both dials", async ({ page }) => {
  await page.goto("/proto/new/guests");

  await screen(page).getByRole("button", { name: "Up to 5 participants" }).click();
  await expect(screen(page).getByTestId("price")).toHaveText("Free");

  await screen(page).getByRole("button", { name: "Up to 100 participants" }).click();
  const at24 = await screen(page).getByTestId("price").textContent();

  await screen(page).getByRole("button", { name: "36", exact: true }).click();
  await expect(screen(page).getByTestId("price")).not.toHaveText(at24 ?? "");
});

test("there is no unlimited shots option", async ({ page }) => {
  await page.goto("/proto/new/guests");

  await expect(screen(page).getByRole("button", { name: "100", exact: true })).toBeVisible();
  await expect(screen(page).getByText("∞")).toHaveCount(0);
});

test("the visibility toggle states who can see what", async ({ page }) => {
  await page.goto("/proto/new/guests");

  await expect(screen(page).getByText("Only host can see all photos.")).toBeVisible();
  await screen(page).getByRole("switch").click();
  await expect(screen(page).getByText("Everyone can see all photos.")).toBeVisible();
});

test("creating demands a valid coupon", async ({ page }) => {
  await page.goto("/proto/new/guests");
  await screen(page).getByRole("button", { name: /Create/ }).click();

  await expect(screen(page).getByRole("heading", { name: "Enter your coupon code" })).toBeVisible();

  await screen(page).getByLabel("Coupon code", { exact: true }).fill("NOPE");
  await screen(page).getByRole("button", { name: "Apply" }).click();
  // The copy uses a typographic apostrophe, so the assertion avoids the character entirely.
  await expect(screen(page).getByText(/valid or has already been used/)).toBeVisible();
  await expect(screen(page).getByRole("heading", { name: "Roll Created!" })).toHaveCount(0);

  await screen(page).getByLabel("Coupon code", { exact: true }).fill("MEMOVUE100");
  await screen(page).getByRole("button", { name: "Apply" }).click();
  await expect(screen(page).getByRole("heading", { name: "Roll Created!" })).toBeVisible();
  // The code appears twice — on its own line and inside the join URL.
  await expect(screen(page).getByText("Share Code: K7M2XQP9")).toBeVisible();
  await expect(screen(page).getByText("https://memovue.com/f/K7M2XQP9")).toBeVisible();
});
