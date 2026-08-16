import { expect, test } from "@playwright/test";

import { screen } from "./helpers";

test("reveal mode changes what the sample photos show", async ({ page }) => {
  await page.goto("/proto/new/reveal");

  await screen(page).getByRole("button", { name: /During Event/ }).click();
  await expect(screen(page).getByText(/Reveals on/)).toHaveCount(0);

  await screen(page).getByRole("button", { name: /After Event/ }).click();
  await expect(screen(page).getByText(/Reveals on/)).toBeVisible();
  const atClose = await screen(page).getByText(/Reveals on/).textContent();

  await screen(page).getByRole("button", { name: /Additional Delay/ }).click();
  await expect(screen(page).getByText(/Reveals on/)).not.toHaveText(atClose ?? "");
});

test("the delay stepper moves the reveal time and is bounded", async ({ page }) => {
  await page.goto("/proto/new/reveal");
  await screen(page).getByRole("button", { name: /Additional Delay/ }).click();

  await expect(screen(page).getByTestId("delay-hours")).toHaveText("12");
  await screen(page).getByRole("button", { name: "Increase delay" }).click();
  await expect(screen(page).getByTestId("delay-hours")).toHaveText("13");

  await screen(page).getByRole("button", { name: "Decrease delay" }).click({ clickCount: 20 });
  await expect(screen(page).getByTestId("delay-hours")).toHaveText("1");
});

test("the invitation card previews the title the host typed", async ({ page }) => {
  // Walked by link rather than by goto: a full page load would reset the draft, and what
  // this is checking is that it survives all five steps.
  await page.goto("/proto/new/name");
  await screen(page).getByLabel("Event name").fill("Meera's Sangeet");

  for (const step of ["start", "finish", "reveal", "card"]) {
    await screen(page).getByRole("link", { name: /Next/ }).click();
    await expect(page).toHaveURL(new RegExp(`/proto/new/${step}$`));
  }

  await screen(page).getByRole("link", { name: "Preview" }).click();
  await expect(page).toHaveURL(/\/proto\/new\/card\/preview/);

  await expect(screen(page).getByRole("heading", { name: "Meera's Sangeet" })).toBeVisible();
  await expect(screen(page).getByText("Preview User")).toBeVisible();
});
