import { type Browser, expect, test } from "@playwright/test";

import { TEST_HOST } from "./global-setup";

/**
 * Not an assertion suite â€” a screenshot pass over the guest flow, which is the part of the
 * product that can only be looked at by actually driving it. Kept out of the default run.
 *
 * `caret: "initial"` matters: Playwright's default is to hide the text caret, which it does
 * by setting an inline style on the focused input. React sees the DOM change out from under
 * it and reports a hydration mismatch that exists only while a screenshot is being taken.
 */

const OUT = process.env.SHOT_DIR ?? "shots-guest";
const SHOT = { caret: "initial" } as const;

function localDateTime(offsetMinutes: number): string {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

test("capture the guest flow", async ({ browser }: { browser: Browser }) => {
  test.setTimeout(180_000);

  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();

  await host.goto("/login");
  await host.getByLabel("Email").fill(TEST_HOST.email);
  await host.getByLabel("Password").fill(TEST_HOST.password);
  await host.getByRole("button", { name: "Sign in" }).click();
  await expect(host).toHaveURL(/\/dashboard/);

  await host.goto("/dashboard/new");
  await host.screenshot({ path: `${OUT}/host-new-event.png`, fullPage: true, ...SHOT });

  await host.getByLabel("Event name").fill("Meera's 30th");
  await host.getByRole("button", { name: /Birthday/ }).click();
  await host.getByLabel("Whose birthday is it?").fill("Meera");
  await host.getByLabel("When does it start?").fill(localDateTime(-60));
  await host.getByRole("button", { name: "Create event" }).click();
  await expect(host).toHaveURL(/\/dashboard\/events\//);

  await host.screenshot({ path: `${OUT}/host-event.png`, fullPage: true, ...SHOT });
  const eventUrl = host.url();
  const joinCode = (await host.getByTestId("join-code").innerText()).trim();

  /* ------------------------------------------------------------------ guest */

  const guestContext = await browser.newContext({ permissions: ["camera"] });
  const guest = await guestContext.newPage();

  await guest.goto(`/join/${joinCode}`);
  await guest.screenshot({ path: `${OUT}/guest-join.png`, ...SHOT });

  await guest.getByLabel("Your name").fill("Riya Sharma");
  await guest.getByLabel("How do you know Meera?").fill("Cousin");
  await guest.getByRole("button", { name: "Start shooting" }).click();
  await expect(guest.getByTestId("shots-left")).toHaveText("15 left");

  await guest.waitForTimeout(1500);
  await guest.screenshot({ path: `${OUT}/guest-camera.png`, ...SHOT });

  // The review overlay â€” the one moment a guest sees their own frame.
  await guest.getByRole("button", { name: "Take photo" }).click();
  await expect(guest.getByRole("button", { name: "Keep it" })).toBeVisible();
  await guest.waitForTimeout(900);
  await guest.screenshot({ path: `${OUT}/guest-review.png`, ...SHOT });
  await guest.getByRole("button", { name: "Keep it" }).click();

  for (let i = 0; i < 4; i++) {
    await guest.getByRole("button", { name: "Take photo" }).click();
    await expect(guest.getByRole("button", { name: "Keep it" })).toBeVisible();
    await guest.getByRole("button", { name: "Keep it" }).click();
    await expect(guest.getByRole("button", { name: "Keep it" })).toBeHidden();
  }
  await expect(guest.getByText(/Saving \d+ photo/)).toBeHidden({ timeout: 60_000 });

  // Sealed album. Wait for the feed itself, not a fixed beat — the first hit on the API
  // route in dev pays for compiling it.
  await guest.getByRole("button", { name: "See the album" }).click();
  await expect(guest.getByText("Everything unlocks in")).toBeVisible({ timeout: 30_000 });
  await guest.waitForTimeout(900);
  await guest.screenshot({ path: `${OUT}/guest-album-sealed.png`, fullPage: true, ...SHOT });

  /* ------------------------------------------------------------------ reveal */

  await host.goto(eventUrl);
  await host.getByRole("button", { name: "Reveal photos now" }).click();
  await host.getByRole("button", { name: "Yes, reveal now" }).click();
  await expect(async () => {
    await host.reload();
    await expect(host.getByRole("link", { name: "Download everything" })).toBeVisible({
      timeout: 3000,
    });
  }).toPass({ timeout: 30_000 });

  await guest.reload();
  await expect(guest.getByRole("button", { name: "Everyone" })).toBeVisible();
  const tiles = guest.locator("img[src^='http']");
  await expect(tiles.first()).toBeVisible({ timeout: 20_000 });
  await guest.waitForTimeout(1600);
  await guest.screenshot({ path: `${OUT}/guest-album-revealed.png`, fullPage: true, ...SHOT });

  await guest.getByRole("button", { name: "By person" }).click();
  await guest.waitForTimeout(600);
  await guest.screenshot({ path: `${OUT}/guest-album-people.png`, fullPage: true, ...SHOT });

  await guest.getByRole("button", { name: "Everyone" }).click();
  await tiles.first().click();
  await expect(guest.getByRole("link", { name: "Save" }).first()).toBeVisible();
  await guest.waitForTimeout(900);
  await guest.screenshot({ path: `${OUT}/guest-viewer.png`, ...SHOT });

  await guestContext.close();
  await hostContext.close();
});

