import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
  test("landing page renders and never scrolls sideways", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Every memory, one album");
    await expect(page.getByRole("link", { name: "Get started" }).first()).toBeVisible();

    // Decorative glows bleed past their columns on purpose; the page must still not scroll.
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
  });

  test("every call to action leads to the same place", async ({ page }) => {
    await page.goto("/");

    const starts = page.getByRole("link", { name: "Get started" });
    await expect(starts).toHaveCount(3);
    for (const link of await starts.all()) {
      await expect(link).toHaveAttribute("href", "/welcome");
    }
  });

  test("welcome offers Google and the guest route, and nothing else", async ({ page }) => {
    await page.goto("/welcome");

    await expect(page.getByText("Welcome to MemoVue")).toBeVisible();
    await expect(page.getByRole("link", { name: /Invited\? Join a roll/ })).toBeVisible();
    await expect(page.getByText("Apple")).toHaveCount(0);
    // No password field anywhere: there are no passwords.
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test("legal pages are reachable from the footer", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Terms" }).first().click();
    await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
    // The retention promise guests and hosts are actually relying on.
    await expect(page.getByText(/30 days after the roll closes/)).toBeVisible();

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  });

  test("a bad join code fails gracefully rather than crashing", async ({ page }) => {
    await page.goto("/join/ZZZZZZ");
    await expect(page.getByRole("heading", { name: /couldn't find that roll/i })).toBeVisible();
  });

  test("host pages are gated behind sign-in", async ({ page }) => {
    await page.goto("/rolls");
    await expect(page).toHaveURL(/\/welcome/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/welcome/);

    await page.goto("/new/name");
    await expect(page).toHaveURL(/\/welcome/);
  });

  test("the guest app sends strangers to the join screen", async ({ page }) => {
    await page.goto("/e/ZZZZZZ");
    await expect(page).toHaveURL(/\/join\/ZZZZZZ/);
  });

  test("Google sign-in starts a real OAuth round trip", async ({ page }) => {
    // Follows the redirect only far enough to prove we hand off to Google with a state
    // parameter — without it the callback would be an open login endpoint.
    const response = await page.request.get("/api/auth/google/start", {
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(307);
    const location = response.headers()["location"] ?? "";
    expect(location).toContain("accounts.google.com");
    expect(location).toContain("state=");
  });
});
