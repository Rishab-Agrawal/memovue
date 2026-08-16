import { expect, test } from "@playwright/test";

import { STORAGE_STATE, TEST_COUPON } from "./global-setup";

/**
 * One roll, end to end: a host creates it, a guest shoots it, and nothing is legible until
 * the host opens it.
 *
 * The host arrives with a session cookie minted in global-setup rather than by signing in —
 * sign-in is Google now, and a browser cannot complete that round trip unattended.
 */
test.describe("a roll from creation to reveal", () => {
  test.use({ storageState: STORAGE_STATE });
  test.describe.configure({ mode: "serial" });

  let joinUrl = "";
  let rollUrl = "";

  test("the host creates a roll, spending a coupon", async ({ page }) => {
    await page.goto("/new/name");

    await page.getByLabel("Event name").fill("Playwright Roll");
    await page.getByRole("link", { name: /Next/ }).click();

    // Start, finish, reveal and the invitation card all keep their defaults.
    for (const step of ["finish", "reveal", "card", "guests"]) {
      await page.getByRole("link", { name: /Next/ }).click();
      await expect(page).toHaveURL(new RegExp(`/new/${step}$`));
    }

    await page.getByRole("button", { name: /Create/ }).click();
    await expect(page.getByRole("heading", { name: "Enter your coupon code" })).toBeVisible();

    // A wrong code is refused, and refused without saying which half was wrong.
    await page.getByLabel("Coupon code", { exact: true }).fill("NOPETHIS");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText(/valid or has already been used/)).toBeVisible();

    await page.getByLabel("Coupon code", { exact: true }).fill(TEST_COUPON);
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page.getByRole("heading", { name: "Roll Created!" })).toBeVisible();
    const shareLine = await page.getByText(/Share Code:/).textContent();
    const code = (shareLine ?? "").replace("Share Code:", "").trim();
    expect(code).toHaveLength(6);

    joinUrl = `/join/${code}`;

    await page.getByRole("button", { name: "OK" }).click();
    await expect(page).toHaveURL(/\/rolls\/[a-z0-9]+$/);
    rollUrl = page.url();
  });

  test("the same coupon cannot be spent twice", async ({ page }) => {
    await page.goto("/new/name");
    await page.getByLabel("Event name").fill("Second Roll");
    for (const step of ["start", "finish", "reveal", "card", "guests"]) {
      void step;
      await page.getByRole("link", { name: /Next/ }).click();
    }

    await page.getByRole("button", { name: /Create/ }).click();
    await page.getByLabel("Coupon code", { exact: true }).fill(TEST_COUPON);
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page.getByText(/valid or has already been used/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Roll Created!" })).toHaveCount(0);
  });

  test("a guest joins with a name and shoots", async ({ browser }) => {
    // A fresh context: the guest has no host cookie, which is the whole point of the QR.
    const context = await browser.newContext({ permissions: ["camera"] });
    const page = await context.newPage();

    await page.goto(joinUrl);
    await page.getByPlaceholder("Enter your name").fill("Meera");
    await page.getByRole("button", { name: /Take your camera/ }).click();

    await expect(page).toHaveURL(/\/e\/[A-Z0-9]{6}$/);
    await expect(page.getByTestId("shots-left")).toBeVisible();

    const before = Number(await page.getByTestId("shots-left").textContent());
    await page.getByRole("button", { name: "Take photo" }).click();

    // No keep/retake: the shot is spent the moment the shutter fires.
    await expect(page.getByText(/Keep it/i)).toHaveCount(0);
    await expect(page.getByTestId("shots-left")).toHaveText(String(before - 1));

    await context.close();
  });

  test("nothing is legible before the reveal, to anyone", async ({ page }) => {
    await page.goto(rollUrl);

    await expect(page.getByText(/Reveals in/).first()).toBeVisible();
    // The host is not exempt: the download is refused too.
    const rollId = rollUrl.split("/").pop();
    const response = await page.request.get(`/api/rolls/${rollId}/download`);
    expect(response.status()).toBe(403);
  });
});
