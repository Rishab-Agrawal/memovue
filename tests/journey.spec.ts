import { expect, type Page, test } from "@playwright/test";

import { MIN_FILL_MS } from "@/lib/bot-check";
import { MONTHS, toWall } from "@/lib/format";

import { GUEST_STORAGE_STATE, STORAGE_STATE, TEST_GUEST, TEST_HOST } from "./global-setup";

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
  // Exact, because the day is a substring of two others in the same grid: on the 4th of the
  // month, "4 Sep 2026" also matches "14 Sep 2026" and "24 Sep 2026", and the run fails on
  // days 1-9 only. Playwright matches accessible names loosely unless told not to.
  await page
    .getByRole("button", { name: `${today.day} ${MONTHS[today.month]} ${today.year}`, exact: true })
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
  /** What a camera reads before its first shot, filled in by the first guest to take one. */
  let fullQuota = 0;

  /**
   * A browser that has never been anybody here — which is what a scanned QR is.
   *
   * Spelled out, because a context built with `browser.newContext()` inherits this describe's
   * `storageState`: without this, a "guest" arrives holding the host's cookie, is recognised
   * by account, and every test below it quietly checks the host walking into their own roll.
   */
  const ANONYMOUS = { storageState: { cookies: [], origins: [] } };

  test("the host creates a roll, spending one off the allowance", async ({ page }) => {
    await page.goto("/new/name");

    await page.getByLabel("Event name").fill("Playwright Roll");
    await page.getByRole("link", { name: /Next/ }).click();

    await startTodayAtMidnight(page);

    // Finish, reveal and the invitation card all keep their defaults.
    for (const step of ["finish", "reveal", "guests"]) {
      await page.getByRole("link", { name: /Next/ }).click();
      await expect(page).toHaveURL(new RegExp(`/new/${step}$`));
    }

    await page.getByRole("button", { name: /Create/ }).click();

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

  /**
   * The wall pages, and the number it pages by comes off the URL.
   *
   * The host screen used to load every READY frame in the roll on all four of its routes,
   * which at five hundred guests is eighteen thousand tiles and a twenty-megabyte payload.
   * It asks for a page now, and `?photos=` is how the "show more" link asks for the next —
   * so it is a number a caller writes, on a screen that renders the host's own album, and it
   * has to survive being written badly.
   */
  test("the wall survives whatever is put in its page parameter", async ({ page }) => {
    for (const value of ["abc", "-5", "999999999", ""]) {
      const response = await page.goto(`${rollUrl}?photos=${value}`);
      expect(response?.status(), `?photos=${value}`).toBe(200);
      // The roll still renders rather than erroring into the boundary.
      await expect(page.getByRole("link", { name: "Take a photo" })).toBeVisible();
    }
  });

  /**
   * A sheet is a modal, and the dimmed part of a modal is its exit.
   *
   * All three sheets here are routes rendering the roll screen behind themselves, and the
   * scrim over that screen was an inert div — so tapping away from Settings or People did
   * nothing and the only way back was the hardware button. One `Sheet` serves all three, so
   * this walks all three.
   */
  test("tapping away from a sheet closes it", async ({ page }) => {
    for (const sheet of ["settings", "people", "invite"]) {
      await page.goto(`${rollUrl}/${sheet}`);

      const scrim = page.getByRole("link", { name: "Close" });
      await expect(scrim, `${sheet} offers a way out`).toHaveAttribute("href", new URL(rollUrl).pathname);

      // Up where the roll screen shows through, nowhere near the panel.
      await page.mouse.click(120, 60);
      await expect(page).toHaveURL(rollUrl);
    }
  });

  /**
   * The link the host actually hands out has to resolve.
   *
   * Everything else in this file builds `/join/<code>` for itself, which is precisely how the
   * invite sheet shipped pointing at `/j/<code>` — a route that has never existed — without a
   * single test noticing. So this one takes the URL off the sheet the way a guest takes it off
   * a printed card, and follows it.
   */
  test("the invite sheet hands out a link that resolves", async ({ page }) => {
    await page.goto(`${rollUrl}/invite`);

    const shared = (await page.getByText(/\/join\/|\/j\//).first().textContent())?.trim() ?? "";
    expect(new URL(shared).pathname).toBe(joinUrl);

    // The QR carries the same string, so a scan and a tap cannot diverge.
    await expect(page.getByRole("img", { name: /^QR code linking to/ })).toHaveAttribute(
      "alt",
      `QR code linking to ${shared}`,
    );

    const response = await page.goto(new URL(shared).pathname);
    expect(response?.status()).toBe(200);
    await expect(page.getByPlaceholder("Enter your name")).toBeVisible();
  });

  /**
   * The allowance is the whole beta gate: spent on creation, refused at zero, and handed back
   * when a roll is deleted before its event ever began.
   *
   * That last rule is the one worth a browser. Deleting a roll nobody has shot on has cost us
   * nothing, so making somebody ask for access again because they fixed a typo by starting
   * over is a penalty for tidiness — and it is the kind of thing that silently stops working
   * the next time anything about deletion moves.
   */
  test("the allowance is spent, refused at zero, and returned by an unstarted roll", async ({
    page,
  }) => {
    // The second and last roll on the allowance. Left on the wizard's defaults, so it opens
    // on the coming Saturday and has therefore not started.
    await page.goto("/new/name");
    await page.getByLabel("Event name").fill("Second Roll");
    // Each step is waited for. Five Next clicks in a row race the router and all land on
    // the same screen, which is how this loop used to sit on /new/start until it timed out.
    for (const step of ["start", "finish", "reveal", "guests"]) {
      await page.getByRole("link", { name: /Next/ }).click();
      await expect(page).toHaveURL(new RegExp(`/new/${step}$`));
    }
    await page.getByRole("button", { name: /Create/ }).click();

    await expect(page.getByRole("heading", { name: "Roll Created!" })).toBeVisible();
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page).toHaveURL(/\/rolls\/[a-z0-9]+$/);
    const secondUrl = page.url();

    /*
      And it has no camera yet, which is the whole difference between this roll and the one
      above. The control used to be live from the moment a roll existed, so a host tapping it
      the week before their wedding was handed a viewfinder the guest app then refused film
      to. It stays in the row, dead, and says when it opens.
    */
    await expect(page.getByLabel("Take a photo")).toHaveAttribute("aria-disabled", "true");
    // Forced, because Playwright reads `aria-disabled` as unclickable and a real thumb does
    // not: the point of the control is that it answers when tapped.
    await page.getByLabel("Take a photo").click({ force: true });
    await expect(page.getByRole("status")).toContainText("Your roll opens");

    /*
      Nothing left, so the way into the wizard stops being a link at all. The refusal has to
      land before the six steps, not after them — being told no once you have picked a date,
      a reveal rule and a cover is the worst possible moment to hear it.
    */
    await page.goto("/rolls");
    await page.getByRole("button", { name: /Create roll/ }).click();
    await expect(page.getByRole("heading", { name: /don.t have access yet/ })).toBeVisible();

    // And the way out of the refusal is a form, not a dead end.
    await page.getByRole("button", { name: "Request" }).click();
    await page.getByLabel("Event type").fill("Playwright wedding");

    /*
      The one wait in this file that is not waiting for anything.

      The form refuses a submission that arrives faster than somebody could have read it, and
      Playwright gets from page load to Submit in a few hundred milliseconds — so without this
      the test asserts that the bot check works rather than that the form does. It stands in
      for a person here, so it spends what a person would.
    */
    await page.waitForTimeout(MIN_FILL_MS);

    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Beta access request sent")).toBeVisible();

    // Deleting it before it opens gives the roll back.
    await page.goto(secondUrl + "/settings");
    await page.getByRole("button", { name: "Delete", exact: true }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/rolls$/);

    await page.getByRole("link", { name: /Create roll/ }).click();
    await expect(page).toHaveURL(/\/new\/name$/);
  });

  test("a guest joins with a name and shoots", async ({ browser }) => {
    const context = await browser.newContext({ ...ANONYMOUS, permissions: ["camera"] });
    const page = await context.newPage();

    await page.goto(joinUrl);
    await page.getByPlaceholder("Enter your name").fill("Meera");
    await page.getByRole("button", { name: /Take your camera/ }).click();

    await expect(page).toHaveURL(/\/e\/[A-Z0-9]{6}$/);
    await expect(page.getByTestId("shots-left")).toBeVisible();

    const before = Number(await page.getByTestId("shots-left").textContent());
    fullQuota = before;
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

    /*
      The seal, on the endpoint that now enforces it.

      `/photos` used to refuse a sealed roll outright and the grid came down inside the status
      poll instead. That is backwards from a cost point of view — the poll repeats every
      twenty seconds and the grid does not — so the paging route serves both sides of the seal
      now, and the invariant moved with it. A sealed page carries a blur placeholder and no
      `previewUrl`, because that field is the only one in the payload that leads to bytes.
    */
    const sealed = await page.request.get(`/api/r/${code}/photos`);
    expect(sealed.ok()).toBeTruthy();

    const { items } = (await sealed.json()) as {
      items: { blurData: string; previewUrl?: string; fullUrl?: string }[];
    };
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.previewUrl).toBeUndefined();
      // The originals travel in the same payload now, so the seal has two fields to keep shut.
      expect(item.fullUrl).toBeUndefined();
      expect(item.blurData).toMatch(/^data:image\/jpeg/);
    }

    await context.close();
  });

  /**
   * Two people called the same thing, which at a wedding is most of them.
   *
   * A name used to be unique inside a roll, so the second Meera was refused at the door and
   * offered somebody else's camera to take over. A guest is the browser now: this context has
   * never seen the roll, so it joins, and both Meeras keep their own frames and their own
   * shot quota.
   */
  test("a second guest with a name already in the roll still gets a camera", async ({
    browser,
  }) => {
    const context = await browser.newContext({ ...ANONYMOUS, permissions: ["camera"] });
    const page = await context.newPage();

    await page.goto(joinUrl);
    await page.getByPlaceholder("Enter your name").fill("Meera");
    await page.getByRole("button", { name: /Take your camera/ }).click();

    await expect(page).toHaveURL(/\/e\/[A-Z0-9]{6}$/);
    // Their own film, not what the first Meera has left after shooting one.
    await expect(page.getByTestId("shots-left")).toHaveText(String(fullQuota));

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
    // Who invited them, credited on the card. The words around the name are the card's to
    // choose — at two cards to a row there is no room for a sentence, so the person glyph
    // carries the "invited by" and this asserts the attribution rather than the phrasing.
    await expect(page.getByText(TEST_HOST.name)).toBeVisible();

    await context.close();
  });

  /**
   * The same account, on a phone that has never seen this roll.
   *
   * A guest cookie is per browser and is the whole of an anonymous guest's identity, so
   * without the account fallback this lands on the name screen and joining again would spend
   * a second spot on the roll and hand out a second shot quota. An account is the one way to
   * be the same person on two phones, which is what makes this fallback the feature.
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

    // A roll that is still shooting carries a camera and a way to invite people to it, and
    // nothing else: there is no album to save yet, and a permanently greyed-out Save is a
    // control that has never once done anything on this screen.
    await expect(page.getByRole("link", { name: "Invite guests" })).toBeVisible();
    await expect(page.getByLabel("Take a photo")).toBeVisible();
    await expect(page.getByLabel("Download album")).toHaveCount(0);

    // The host is not exempt: the download is refused too.
    const rollId = rollUrl.split("/").pop();
    const response = await page.request.get(`/api/rolls/${rollId}/download`);
    expect(response.status()).toBe(403);
  });

  /**
   * The reveal, edited from the settings row that used to only display it.
   *
   * A host who picked the wrong option at creation had exactly one move — a "Reveal now"
   * button that opened the roll for good — and no way to make a smaller one. The row is the
   * way in now, and opening early is `DURING` on the same screen the wizard sells the choice
   * on. It also leaves the opened state of the roll screen testable, which is how the album
   * controls were caught pointing at "#".
   *
   * Last in the file on purpose: it opens the roll for good, and everything above it needs
   * the roll sealed.
   */
  test("the host can change the reveal, and open the roll from the same screen", async ({
    page,
  }) => {
    await page.goto(`${rollUrl}/settings`);
    await page.getByRole("link", { name: /Reveal time/ }).click();
    await expect(page).toHaveURL(`${rollUrl}/settings/reveal`);

    // A smaller move first: a delay is a date that can be moved again tomorrow, and the roll
    // stays sealed through it.
    await page.getByRole("button", { name: "Additional\nDelay" }).click();
    await page.getByRole("button", { name: "Increase delay" }).click();
    await expect(page.getByTestId("delay-hours")).toHaveText("2");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(`${rollUrl}/settings`);
    await expect(page.getByText("After + delay")).toBeVisible();
    expect((await page.request.get(`/api/rolls/${rollId()}/download`)).status()).toBe(403);

    // Opening it for good is the one choice that asks first.
    await page.getByRole("link", { name: /Reveal time/ }).click();
    await page.getByRole("button", { name: "During\nEvent" }).click();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(`${rollUrl}/settings/reveal`);
    expect((await page.request.get(`/api/rolls/${rollId()}/download`)).status()).toBe(403);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(`${rollUrl}/settings`);
    // Open for good: the row that led here is a plain row again.
    await expect(page.getByRole("link", { name: /Reveal time/ })).toHaveCount(0);

    /*
      Opened while the shutter is still up, which is what `DURING` means.

      The row stays a camera and an invite, because the party is not over: it splits on the
      roll ending, not on the photographs becoming legible. Opening early used to swap the
      whole row for Send and Save — so a host who chose `DURING` lost their camera and their
      invite button mid-event, with guests still arriving.
    */
    await page.goto(rollUrl);
    await expect(page.getByLabel("Take a photo")).toBeVisible();
    await expect(page.getByRole("link", { name: "Invite guests" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Save" })).toHaveCount(0);

    // The archive route itself is open, though — it is gated on the seal, not the shutter.
    const zip = await page.request.get(`/api/rolls/${rollId()}/download`);
    expect(zip.status()).toBe(200);
    expect(zip.headers()["content-type"]).toContain("zip");

    /*
      Ten of those, for the life of the roll, and then a sentence rather than an archive.

      The refusals above cost nothing — a sealed roll is turned away before the count is
      touched — so this one download is the first spent and nine remain. The eleventh is the
      one that has to say something a host can act on, which means the address in it is part
      of the contract and not decoration.
    */
    for (let i = 1; i < 10; i += 1) {
      expect((await page.request.get(`/api/rolls/${rollId()}/download`)).status()).toBe(200);
    }

    const refused = await page.request.get(`/api/rolls/${rollId()}/download`);
    expect(refused.status()).toBe(403);
    expect(await refused.text()).toContain("hello@memovue.com");

    // And the button says so on the page itself, rather than navigating the host onto it.
    await page.reload();
    await page.getByRole("link", { name: "Save" }).click();
    await expect(page.getByRole("status")).toContainText("already downloaded this roll");
    await expect(page).toHaveURL(rollUrl);
  });

  function rollId() {
    return rollUrl.split("/").pop()!;
  }
});

/**
 * The home screen, and the two ways it used to mislead.
 *
 * Albums used to be the bottom half of this screen, and only appeared once a roll had
 * finished — so a new host saw one block of content and a wide emptiness under it with no
 * indication that finished rolls go anywhere at all. They are a tab of their own now, which
 * is named in the bar whether or not there is anything in it. And Join sat one tap from a
 * page that offers nothing but "Continue with Google", so pressing back after it looked
 * exactly like having been signed out.
 */
test.describe("the home screen after signing in", () => {
  test.use({ storageState: STORAGE_STATE });

  test("home carries the two things to do, and albums are one tab away", async ({ page }) => {
    await page.goto("/rolls");

    // Whatever is or isn't running, both ways to start are on the screen.
    // Either element: the way in is a button rather than a link once the allowance is spent.
    await expect(page.getByText("Create roll")).toBeVisible();
    await expect(page.getByRole("link", { name: "Join" })).toBeVisible();

    // The albums tab exists before there is an album in it, and says so when empty.
    await page.getByRole("link", { name: "Albums" }).click();
    await expect(page).toHaveURL(/\/albums$/);
    await expect(page.getByRole("heading", { name: "Albums" })).toBeVisible();

    // And the bar leads back.
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/rolls$/);
  });

  test("Join and back is not a sign-out", async ({ page }) => {
    await page.goto("/rolls");
    await page.getByRole("link", { name: "Join" }).click();
    await expect(page).toHaveURL(/\/join$/);

    // Back belongs to where they came from, not to the sign-in screen.
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/rolls$/);
    await expect(page.getByText("Create roll")).toBeVisible();

    // And the sign-in screen itself refuses to entertain someone already signed in.
    await page.goto("/welcome");
    await expect(page).toHaveURL(/\/rolls$/);
  });
});
