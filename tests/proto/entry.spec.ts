import { expect, test } from "@playwright/test";

import { screen } from "./helpers";

test("welcome offers Google and the guest route, and nothing else", async ({ page }) => {
  await page.goto("/proto/welcome");

  await expect(screen(page).getByText("Welcome to MemoVue")).toBeVisible();
  await expect(screen(page).getByRole("link", { name: /Invited\? Join film here/ })).toBeVisible();
  await expect(screen(page).getByText("Google")).toBeVisible();
  await expect(page.getByText("Apple")).toHaveCount(0);
});

test("the invalid-link dialog is reachable and dismissible", async ({ page }) => {
  await page.goto("/proto/join?v=invalid");

  await expect(screen(page).getByRole("heading", { name: "Invalid link" })).toBeVisible();
  await screen(page).getByRole("link", { name: "OK" }).click();
  await expect(screen(page).getByRole("heading", { name: "Invalid link" })).toHaveCount(0);
  await expect(screen(page).getByPlaceholder("Paste link")).toBeVisible();
});
