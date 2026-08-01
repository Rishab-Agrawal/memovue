import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
  test("landing page renders and never scrolls sideways", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Nobody sees a thing");
    await expect(page.getByRole("link", { name: "Create an event" }).first()).toBeVisible();

    // Decorative glows bleed past their columns on purpose; the page must still not scroll.
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
  });

  test("legal pages are reachable from the footer", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Terms" }).first().click();
    await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
    // The retention promise guests and hosts are actually relying on.
    await expect(page.getByText(/at least 30 days before anything is deleted/)).toBeVisible();

    await page.getByRole("link", { name: "Privacy" }).first().click();
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  });

  test("a bad join code fails gracefully rather than crashing", async ({ page }) => {
    await page.goto("/join/ZZZZZZ");
    await expect(page.getByRole("heading", { name: /couldn't find that event/i })).toBeVisible();
  });

  test("manual code entry rejects short codes and routes valid ones", async ({ page }) => {
    await page.goto("/join");

    const submit = page.getByRole("button", { name: "Continue" });
    await expect(submit).toBeDisabled();

    await page.getByLabel("Join code").fill("zzz-zzz");
    await expect(submit).toBeEnabled();
    await submit.click();
    // Lowercase and punctuation are normalised before routing.
    await expect(page).toHaveURL(/\/join\/ZZZZZZ/);
  });

  test("host pages are gated behind sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("the guest app sends strangers to the join screen", async ({ page }) => {
    await page.goto("/e/ZZZZZZ");
    await expect(page).toHaveURL(/\/join\/ZZZZZZ/);
  });
});
