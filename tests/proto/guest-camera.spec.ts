import { expect, test } from "@playwright/test";

import { screen } from "./helpers";

test("the invitation needs a name before handing over a camera", async ({ page }) => {
  await page.goto("/proto/guest");

  await expect(screen(page).getByText(/Invited by Rishab/)).toBeVisible();
  await expect(screen(page).getByText(/24 shots available/)).toBeVisible();

  const go = screen(page).getByRole("link", { name: /Take your camera/ });
  await expect(go).toHaveAttribute("aria-disabled", "true");

  await screen(page).getByPlaceholder("Enter your name").fill("Meera");
  await expect(go).not.toHaveAttribute("aria-disabled", "true");
});

test("the shutter spends a shot with no confirmation step", async ({ page }) => {
  await page.goto("/proto/guest/camera");

  await expect(screen(page).getByTestId("shots-left")).toHaveText("24");
  await screen(page).getByRole("button", { name: "Take photo" }).click();

  await expect(screen(page).getByText(/Keep it/i)).toHaveCount(0);
  await expect(screen(page).getByText(/Retake/i)).toHaveCount(0);

  // The count drops only once the frame has landed in the gallery.
  await expect(screen(page).getByTestId("shots-left")).toHaveText("23");
});

test("the gallery thumbnail opens the album", async ({ page }) => {
  await page.goto("/proto/guest/camera");

  await screen(page).getByRole("link", { name: "Open album" }).click();
  await expect(page).toHaveURL(/\/proto\/guest\/album/);
});
