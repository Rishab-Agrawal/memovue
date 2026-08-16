import { expect, test } from "@playwright/test";

import { screen } from "./helpers";

test("before the reveal a guest sees only sealed frames", async ({ page }) => {
  await page.goto("/proto/guest/album");

  await expect(screen(page).getByText("Sign up to keep your memories alive.")).toBeVisible();
  await expect(screen(page).getByText(/Only the host can see everyone/)).toBeVisible();
  await expect(screen(page).getByText(/Reveals in/).first()).toBeVisible();
});

test("host-only visibility shows the guest their own photos and no one else's", async ({
  page,
}) => {
  await page.goto("/proto/guest/album?v=after-host-only");

  await expect(screen(page).getByText("You").first()).toBeVisible();
  await expect(screen(page).getByText("Meera")).toHaveCount(0);
  await expect(screen(page).getByText(/Only the host can see everyone/)).toBeVisible();
  await expect(screen(page).getByText(/Reveals in/)).toHaveCount(0);
});

test("open visibility credits every photographer", async ({ page }) => {
  await page.goto("/proto/guest/album?v=after-everyone");

  await expect(screen(page).getByText("Meera").first()).toBeVisible();
  await expect(screen(page).getByText("You").first()).toBeVisible();
  await expect(screen(page).getByText(/Only the host can see everyone/)).toHaveCount(0);
});

test("the viewer offers one centred Save and nothing else", async ({ page }) => {
  await page.goto("/proto/guest/album/photo");

  await expect(screen(page).getByRole("button", { name: "Save" })).toBeVisible();
  await expect(screen(page).getByRole("button", { name: /share/i })).toHaveCount(0);
  await expect(screen(page).getByRole("button", { name: "More" })).toHaveCount(0);

  await screen(page).getByRole("link", { name: "Close" }).click();
  await expect(page).toHaveURL(/\/proto\/guest\/album/);
});

test("a revealed tile opens the viewer", async ({ page }) => {
  await page.goto("/proto/guest/album?v=after-everyone");

  await screen(page).getByRole("link", { name: /^Photo by/ }).first().click();
  await expect(page).toHaveURL(/\/proto\/guest\/album\/photo/);
});
