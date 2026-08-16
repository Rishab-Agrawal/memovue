import { expect, test } from "@playwright/test";

import { screen } from "./helpers";

test("the name step drops the reference's suggestions", async ({ page }) => {
  await page.goto("/proto/new/name");

  await expect(screen(page).getByText("What is the name of your event?")).toBeVisible();
  await expect(page.getByText("Suggestions")).toHaveCount(0);
});

test("the start step has no skip, and refuses dates beyond two years", async ({ page }) => {
  await page.goto("/proto/new/start");

  await expect(page.getByRole("button", { name: "Skip" })).toHaveCount(0);
  await expect(screen(page).getByRole("link", { name: /Next/ })).toBeVisible();

  // The roll starts Sep 2026, so Sep 2028 is the last reachable month. Twenty-five clicks
  // forward lands past it, where no day is selectable.
  await screen(page).getByRole("button", { name: "Next month" }).click({ clickCount: 25 });
  await expect(screen(page).getByRole("button", { name: "15", exact: true })).toHaveCount(0);
});

test("the finish step is clamped to two months after the start", async ({ page }) => {
  await page.goto("/proto/new/finish");

  await expect(screen(page).getByText("When does your event finish?")).toBeVisible();
  await screen(page).getByRole("button", { name: "Next month" }).click({ clickCount: 3 });
  await expect(screen(page).getByRole("button", { name: "15", exact: true })).toHaveCount(0);
});

test("the draft carries forward and back across steps", async ({ page }) => {
  await page.goto("/proto/new/name");

  await screen(page).getByLabel("Event name").fill("Meera's Sangeet");
  await screen(page).getByRole("link", { name: /Next/ }).click();
  await expect(page).toHaveURL(/\/proto\/new\/start/);

  await screen(page).getByRole("link", { name: "Back" }).click();
  await expect(screen(page).getByLabel("Event name")).toHaveValue("Meera's Sangeet");
});

test("picking a time updates the row it came from", async ({ page }) => {
  await page.goto("/proto/new/start");

  await expect(screen(page).getByRole("button", { name: "6:00 PM" })).toBeVisible();
  await screen(page).getByRole("button", { name: "6:00 PM" }).click();

  await page.getByRole("listbox", { name: "Hour" }).getByRole("option", { name: "09" }).click();
  await page.getByRole("button", { name: "Done" }).click();

  await expect(screen(page).getByRole("button", { name: "9:00 AM" })).toBeVisible();
});
