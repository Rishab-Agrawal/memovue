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

  /**
   * The front door asks for nothing.
   *
   * It used to open with a full-width "Continue with Google" and no other way forward, and
   * people who had come to look at a product left rather than make an account for one they
   * had not seen yet. All three things you can do here have to work without one; sign-in is
   * the small door in the corner, for people who already have an account.
   */
  test("welcome leads into the product without an account", async ({ page }) => {
    await page.goto("/welcome");

    await expect(page.getByText("Welcome to MemoVue")).toBeVisible();
    await expect(page.getByRole("link", { name: "Create a roll" })).toHaveAttribute(
      "href",
      "/new/name",
    );
    await expect(page.getByRole("link", { name: /sample album/i })).toHaveAttribute(
      "href",
      "/albums/sample/camera",
    );
    await expect(page.getByRole("link", { name: /Invited\? Join a roll/ })).toBeVisible();

    // Sign-in is still here, and is still Google and nothing else.
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("Apple")).toHaveCount(0);
    // No password field anywhere: there are no passwords.
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  /**
   * The wizard, walked by nobody.
   *
   * Nothing before the last step writes anything — the draft lives in the tab — so every
   * screen up to Create is free, and Create is where an account finally buys something.
   * Getting this wrong in either direction is bad: a gate on the way in is the problem this
   * replaced, and a missing gate at the end would fire an anonymous request at the action.
   */
  test("anyone can walk the wizard, and is asked for an account at the end", async ({ page }) => {
    await page.goto("/new/name");

    await page.getByLabel("Event name").fill("Curious visitor");
    for (const step of ["start", "finish", "reveal", "guests"]) {
      await page.getByRole("link", { name: /Next/ }).click();
      await expect(page).toHaveURL(new RegExp(`/new/${step}$`));
    }

    await page.getByRole("button", { name: /Create/ }).click();

    await expect(page.getByRole("heading", { name: "All set" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
      "href",
      "/api/auth/google/start?next=/new/guests%3Fcreate=1",
    );
    // And nothing was created on the way to the gate.
    await expect(page.getByRole("heading", { name: "Roll Created!" })).toHaveCount(0);
  });

  /**
   * The sample camera: a real viewfinder over no roll.
   *
   * The shutter itself needs a camera the runner does not have, so what is held down here is
   * the frame around it — the film a visitor is handed, the thumbnail standing in for a last
   * shot they have not taken, and the two doors, one of which differs from a guest's on
   * purpose.
   */
  test("the sample camera runs without an account and leads both ways", async ({ page }) => {
    await page.goto("/albums/sample/camera");

    await expect(page.getByTestId("shots-left")).toHaveText("21");

    // The arrow leaves the product rather than opening somebody else's album.
    await page.getByRole("link", { name: "Leave the camera" }).click();
    await expect(page).toHaveURL(/\/welcome$/);

    // The thumbnail is what opens it.
    await page.goto("/albums/sample/camera");
    await page.getByRole("button", { name: "Open the roll" }).click();
    await expect(page).toHaveURL(/\/albums\/sample$/);
    await expect(page.getByRole("heading", { name: "Priya and Arjun's Wedding" })).toBeVisible();
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
    // The apostrophe on the page is a typographic one, so match around it rather than
    // guessing which character it is.
    await expect(page.getByRole("heading", { name: /find that roll/i })).toBeVisible();
  });

  test("host pages are gated behind sign-in", async ({ page }) => {
    await page.goto("/rolls");
    await expect(page).toHaveURL(/\/welcome/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/welcome/);

    // The wizard is deliberately off this list now; the albums tab is a host's own shelf.
    await page.goto("/albums");
    await expect(page).toHaveURL(/\/welcome/);
  });

  test("the guest app sends strangers to the join screen", async ({ page }) => {
    await page.goto("/e/ZZZZZZ");
    await expect(page).toHaveURL(/\/join\/ZZZZZZ/);
  });

  /**
   * Swiping the album faster than it settles.
   *
   * The viewer used to commit the frame change on the spring's rest, so a second swipe taken
   * before the first had landed stopped that spring and threw the move away — and a fast hand
   * bounced between the first two photographs for ever. The sample album is three frames and
   * needs no account, which makes it the cheapest place to hold that down.
   */
  test("swiping faster than the animation settles still moves through the album", async ({
    page,
  }) => {
    await page.goto("/albums/sample");
    await page.getByRole("button", { name: "Photo by Kabir" }).click();
    await expect(page.getByText("1 of 3")).toBeVisible();

    // Back to back, with no pause: the second gesture lands mid-flight, which is the case
    // that was broken.
    for (let i = 0; i < 2; i += 1) {
      await page.mouse.move(340, 420);
      await page.mouse.down();
      await page.mouse.move(240, 420);
      await page.mouse.move(70, 420);
      await page.mouse.up();
    }

    await expect(page.getByText("3 of 3")).toBeVisible();
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
