import { expect, test } from "@playwright/test";

test("welcome offers Google and the guest route, and nothing else", async ({ page }) => {
  await page.goto("/proto/welcome");

  await expect(page.getByText("Welcome to MemoVue")).toBeVisible();
  await expect(page.getByRole("link", { name: /Invited\? Join film here/ })).toBeVisible();
  await expect(page.getByText("Google")).toBeVisible();
  await expect(page.getByText("Apple")).toHaveCount(0);
});

test("the invalid-link dialog is reachable and dismissible", async ({ page }) => {
  await page.goto("/proto/join?v=invalid");

  // Not getByText: the screen bar's own label is "Join film — invalid link".
  await expect(page.getByRole("heading", { name: "Invalid link" })).toBeVisible();
  await page.getByRole("link", { name: "OK" }).click();
  await expect(page.getByRole("heading", { name: "Invalid link" })).toHaveCount(0);
  await expect(page.getByPlaceholder("Paste link")).toBeVisible();
});
