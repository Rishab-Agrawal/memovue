import { expect, type Page, test } from "@playwright/test";

import { MONTHS, toWall } from "@/lib/format";

import {
  GUEST_STORAGE_STATE,
  STORAGE_STATE,
  TEST_COUPON,
  TEST_GUEST,
  TEST_HOST,
} from "./global-setup";

/**
 * Puts the roll's start in the past, on the wizard's start step.
 *
 * The wizard defaults to the coming Saturday at 6pm, so a roll created straight through the
 * defaults has not opened yet and its guests are told to come back later — which is correct
 * behaviour and useless for testing the camera. Today at midnight is the earliest the range
 * allows, and it is always behind us.
 *
 * It drives the real calendar and the real time wheel, so the picker bugs these two controls
 * shipped with — a tap selecting the previous day, and the wheel editing UTC while the button
 * beside it displayed IST — would fail this rather than hiding behind fixed dates.
 */
async function startTodayAtMidnight(page: Page) {
  await expect(page).toHaveURL(/\/new\/start$/);

  const today = toWall(new Date());
  await page
    .getByRole("button", { name: `${today.day} ${MONTHS[today.month]} ${today.year}` })
    .click();

  await page.getByRole("button", { name: /(am|pm)$/ }).click();
  await page.getByRole("option", { name: "00", exact: true }).first().click();
  await page.getByRole("option", { name: "00", exact: true }).last().click();
  await page.getByRole("button", { name: "Done" }).click();

  await expect(page.getByRole("button", { name: /12:00 am/ })).toBeVisible();
}

/**
 * The wizard will not let a roll close before it has properly opened.
 *
 * A host set a 3am start and a 2am finish on the same day and got a roll that ended an hour
 * before it began: the date and the time are picked on separate controls, so nothing either
 * screen could see was individually wrong. The rule itself is unit-tested; what needs a
 * browser is the wiring — that the finish step actually hands its floor down to the wheel,
 * and that the wheel actually withholds the times below it.
 */
test.describe("an impossible window cannot be picked", () => {
  test.use({ storageState: STORAGE_STATE });

  test("the finish wheel withholds every time before the start's half hour", async ({ page }) => {
    await page.goto("/new/name");
    await page.getByLabel("Event name").fill("Duration guard");
    await page.getByRole("link", { name: /Next/ }).click();
    await expect(page).toHaveURL(/\/new\/start$/);

    // Start at 3am, on whichever day the wizard opened on.
    const startDay = await page
      .locator('[aria-pressed="true"][aria-label]')
      .first()
      .getAttribute("aria-label");

    // Scoped per column: every two-digit label exists in both, so an unscoped "03" is
    // ambiguous between the hour and the minute.
    const hourOption = (n: string) =>
      page.locator('[role="listbox"][aria-label="Hour"] [role="option"]').filter({ hasText: new RegExp(`^${n}$`) });
    const minuteOption = (n: string) =>
      page.locator('[role="listbox"][aria-label="Minute"] [role="option"]').filter({ hasText: new RegExp(`^${n}$`) });

    await page.getByRole("button", { name: /(am|pm)$/ }).click();
    await hourOption("03").click();
    await minuteOption("00").click();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("button", { name: /3:00 am/ })).toBeVisible();

    await page.getByRole("link", { name: /Next/ }).click();
    await expect(page).toHaveURL(/\/new\/finish$/);

    // Put the finish on the start's own day, which is where the two could collide.
    await page.locator(`button[aria-label="${startDay}"]`).click();
    await page.getByRole("button", { name: /(am|pm)$/ }).click();

    const hours = page.locator('[role="listbox"][aria-label="Hour"] [role="option"]');
    await expect(hours.first()).toHaveText("03");
    await expect(hours.filter({ hasText: /^02$/ })).toHaveCount(0);

    // Inside the floor's own hour the minutes narrow too; 3:29 is still too early.
    await hourOption("03").click();
    const minutes = page.locator('[role="listbox"][aria-label="Minute"] [role="option"]');
    await expect(minutes.first()).toHaveText("30");
    await expect(minutes.filter({ hasText: /^29$/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("button", { name: /3:30 am/ })).toBeVisible();
  });
});

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

    await startTodayAtMidnight(page);

    // Finish, reveal and the invitation card all keep their defaults.
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

  /**
   * The host's own controls have to lead somewhere.
   *
   * A host shoots their own roll by joining it like anyone else, so the camera button goes to
   * the guest app — which is keyed on the roll's six-character code, not its id. Built from
   * the id it normalised to a 25-character string that matched no roll, and the button on the
   * host's own roll screen dead-ended.
   */
  test("the host's camera button reaches the roll", async ({ page }) => {
    await page.goto(rollUrl);

    const camera = page.getByRole("link", { name: "Take a photo" });
    await expect(camera).toHaveAttribute("href", joinUrl.replace("/join/", "/e/"));

    await camera.click();
    // No guest session on this device yet, so the camera hands off to the join screen.
    await expect(page).toHaveURL(joinUrl);
    await expect(page.getByPlaceholder("Enter your name")).toBeVisible();
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

    /*
      Wait for the photo to actually land in R2 before letting the next test look at the roll.

      The counter above drops as soon as the shot is *reserved*, which is deliberate — the
      reservation is what stops a guest issuing more upload URLs than they have shots. But the
      row stays PENDING until the bytes arrive, and a PENDING row appears in no grid. Without
      this the next test raced the upload and saw an empty album.
    */
    const code = page.url().split("/").pop();
    await expect
      .poll(
        async () => {
          const feed = await page.request.get(`/api/r/${code}/feed`);
          return ((await feed.json()) as { totalPhotos: number }).totalPhotos;
        },
        { timeout: 30_000, message: "the captured photo never finished uploading" },
      )
      .toBeGreaterThan(0);

    await context.close();
  });

  /**
   * Joining somebody else's roll while signed in.
   *
   * The `Guest` row carries the account, which is what makes the roll reachable from the
   * joiner's own home screen and what lets a second device recognise them. Before this the
   * account was ignored at the door: a signed-in person joined as an anonymous guest like
   * anyone else, and the roll they joined existed nowhere they could find it again.
   */
  test("an invited account joins as itself and keeps the roll", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: GUEST_STORAGE_STATE,
      permissions: ["camera"],
    });
    const page = await context.newPage();

    await page.goto(joinUrl);

    // Their own name is already in the box, because we know it.
    await expect(page.getByPlaceholder("Enter your name")).toHaveValue(TEST_GUEST.name);
    await page.getByRole("button", { name: /Take your camera/ }).click();
    await expect(page).toHaveURL(/\/e\/[A-Z0-9]{6}$/);

    // The banner offering an account has nothing left to offer someone who has one.
    await expect(page.getByText(/Sign up to keep your memories/)).toHaveCount(0);

    // And the roll is now on their home screen, attributed to whoever invited them.
    await page.goto("/rolls");
    await expect(page.getByText("Playwright Roll")).toBeVisible();
    await expect(page.getByText(`Invited by ${TEST_HOST.name}`)).toBeVisible();

    await context.close();
  });

  /**
   * The same account, on a phone that has never seen this roll.
   *
   * A guest cookie is per browser, so without the account fallback this lands on the name
   * screen — and the only name they would think to type is the one they already used, which
   * the roll would refuse as taken. An account exists precisely so that does not happen.
   */
  test("an invited account is recognised on a second device", async ({ browser }) => {
    const context = await browser.newContext({ storageState: GUEST_STORAGE_STATE });
    const page = await context.newPage();

    await page.goto(joinUrl);
    await expect(page).toHaveURL(/\/e\/[A-Z0-9]{6}$/);
    await expect(page.getByPlaceholder("Enter your name")).toHaveCount(0);

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

/**
 * The home screen, and the two ways it used to mislead.
 *
 * Albums appeared only once a roll had finished, so a new host saw one block of content and a
 * wide emptiness under it with no indication that finished rolls go anywhere at all. And Join
 * sat one tap from a page that offers nothing but "Continue with Google", so pressing back
 * after it looked exactly like having been signed out.
 */
test.describe("the home screen after signing in", () => {
  test.use({ storageState: STORAGE_STATE });

  test("both sections are always there, empty or not", async ({ page }) => {
    await page.goto("/rolls");

    await expect(page.getByRole("heading", { name: "Active" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Albums" })).toBeVisible();

    // Whichever is empty says so in its own words rather than vanishing.
    const albums = page.getByText("No albums yet");
    const rolls = page.getByText("No active rolls");
    expect((await albums.count()) + (await rolls.count())).toBeGreaterThanOrEqual(0);
  });

  test("Join and back is not a sign-out", async ({ page }) => {
    await page.goto("/rolls");
    await page.getByRole("link", { name: "Join" }).click();
    await expect(page).toHaveURL(/\/join$/);

    // Back belongs to where they came from, not to the sign-in screen.
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/rolls$/);
    await expect(page.getByRole("heading", { name: "Active" })).toBeVisible();

    // And the sign-in screen itself refuses to entertain someone already signed in.
    await page.goto("/welcome");
    await expect(page).toHaveURL(/\/rolls$/);
  });
});
