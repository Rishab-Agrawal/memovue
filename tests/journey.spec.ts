import { type Browser, type Page, expect, test } from "@playwright/test";

import { TEST_HOST } from "./global-setup";

/**
 * One end-to-end pass through the product: a host sets up an event, a guest shoots real
 * frames through a synthetic camera, nothing is visible before the reveal, and everything
 * is visible after it.
 *
 * Deliberately a single sequential test — each step depends on state the previous one
 * created, and splitting it would mean re-driving the whole flow for every assertion.
 */

/** `datetime-local` wants local wall-clock time, not UTC. */
function localDateTime(offsetMinutes: number): string {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_HOST.email);
  await page.getByLabel("Password").fill(TEST_HOST.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function takePhoto(guest: Page) {
  await guest.getByRole("button", { name: "Take photo" }).click();
  await expect(guest.getByRole("button", { name: "Keep it" })).toBeVisible();
  await guest.getByRole("button", { name: "Keep it" }).click();
  // The review overlay closing means the frame is queued and durable.
  await expect(guest.getByRole("button", { name: "Keep it" })).toBeHidden();
}

test("host creates an event, a guest shoots it, and the reveal opens the album", async ({
  browser,
}: {
  browser: Browser;
}) => {
  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();

  /* ---------------------------------------------------------------- create */

  await signIn(host);
  await host.goto("/dashboard/new");

  const eventName = `Playwright Party ${Date.now()}`;
  await host.getByLabel("Event name").fill(eventName);
  await host.getByRole("button", { name: /Birthday/ }).click();
  await host.getByLabel("Whose birthday is it?").fill("Meera");
  // Started an hour ago, so the capture window is already open.
  await host.getByLabel("When does it start?").fill(localDateTime(-60));
  await host.getByRole("button", { name: "Create event" }).click();

  await expect(host).toHaveURL(/\/dashboard\/events\//);
  await expect(host.getByText("Shooting now")).toBeVisible();

  const joinCode = (await host.getByTestId("join-code").innerText()).trim();
  expect(joinCode).toMatch(/^[A-Z0-9]{6}$/);

  /* ---------------------------------------------------------------- join */

  const guestContext = await browser.newContext({ permissions: ["camera"] });
  const guest = await guestContext.newPage();

  await guest.goto(`/join/${joinCode}`);
  await expect(guest.getByRole("heading", { name: eventName })).toBeVisible();

  await guest.getByLabel("Your name").fill("Riya Sharma");
  await guest.getByLabel("How do you know Meera?").fill("Cousin");
  await guest.getByRole("button", { name: "Start shooting" }).click();

  await expect(guest).toHaveURL(new RegExp(`/e/${joinCode}`));
  await expect(guest.getByTestId("shots-left")).toHaveText("15 left");

  /* ---------------------------------------------------------------- duplicate name */

  const gatecrasherContext = await browser.newContext();
  const gatecrasher = await gatecrasherContext.newPage();
  await gatecrasher.goto(`/join/${joinCode}`);
  await gatecrasher.getByLabel("Your name").fill("riya  sharma");
  await gatecrasher.getByLabel("How do you know Meera?").fill("Friend");
  await gatecrasher.getByRole("button", { name: "Start shooting" }).click();
  // Normalisation means casing and extra spaces still collide.
  await expect(gatecrasher.getByText(/already joined as/i)).toBeVisible();
  await gatecrasherContext.close();

  /* ---------------------------------------------------------------- shoot */

  await expect(guest.getByRole("button", { name: "Take photo" })).toBeEnabled();

  await takePhoto(guest);
  await expect(guest.getByTestId("shots-left")).toHaveText("14 left");

  await takePhoto(guest);
  await expect(guest.getByTestId("shots-left")).toHaveText("13 left");

  // Wait for the durable queue to actually flush to R2.
  await expect(guest.getByText(/Saving \d+ photo/)).toBeHidden({ timeout: 45_000 });

  /* ---------------------------------------------------------------- pre-reveal secrecy */

  await guest.getByRole("button", { name: "See the album" }).click();
  await expect(guest.getByText("Everything unlocks in")).toBeVisible();
  await expect(guest.getByText("Riya Sharma")).toBeVisible();

  // The only image data before the reveal must be the inline blur placeholder — no
  // request to real image bytes should be possible.
  const imageSources = await guest.locator("img").evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLImageElement).getAttribute("src") ?? ""),
  );
  expect(imageSources.length).toBeGreaterThan(0);
  for (const source of imageSources) {
    expect(source.startsWith("data:image/")).toBe(true);
  }

  // And the API must refuse to serve the grid at all.
  const early = await guest.request.get(`/api/e/${joinCode}/photos`);
  expect(early.status()).toBe(403);

  /* ---------------------------------------------------------------- reveal */

  await host.reload();
  await host.getByRole("button", { name: "Reveal photos now" }).click();
  await host.getByRole("button", { name: "Yes, reveal now" }).click();

  // Retry on a fresh server render rather than trusting the client-side refresh the action
  // triggers — against a remote deployment that refresh can land after the assertions do.
  // The download link only exists once an event is revealed, so it's the unambiguous signal.
  await expect(async () => {
    await host.reload();
    await expect(host.getByRole("link", { name: "Download everything" })).toBeVisible({
      timeout: 3000,
    });
  }).toPass({ timeout: 30_000 });

  await expect(host.getByTestId("revealed-count")).toHaveText("2");

  /* ---------------------------------------------------------------- after reveal */

  await guest.reload();
  await expect(guest.getByRole("button", { name: "Everyone" })).toBeVisible();

  const tiles = guest.locator("img[src^='http']");
  await expect(tiles.first()).toBeVisible({ timeout: 20_000 });
  expect(await tiles.count()).toBe(2);

  // Opening a photo full screen should show who took it.
  await tiles.first().click();
  await expect(guest.getByText("Riya Sharma").first()).toBeVisible();
  await expect(guest.getByRole("link", { name: "Save" }).first()).toBeVisible();

  /* ---------------------------------------------------------------- back closes the photo */

  // Back is the gesture people actually reach for to leave a full-screen photo, and it has
  // to close the photo rather than the album — being ejected from the album on the one night
  // it opens is the worst possible time for it.
  await guest.goBack();
  await expect(guest.getByRole("dialog", { name: "Photo" })).toBeHidden();
  await expect(guest).toHaveURL(new RegExp(`/e/${joinCode}`));
  await expect(guest.getByRole("button", { name: "Everyone" })).toBeVisible();

  // And closing with the ✕ must spend the same entry, so one further back leaves the album
  // instead of silently re-opening nothing.
  await tiles.first().click();
  await expect(guest.getByRole("dialog", { name: "Photo" })).toBeVisible();
  await guest.getByRole("button", { name: "Close" }).click();
  await expect(guest.getByRole("dialog", { name: "Photo" })).toBeHidden();
  await expect(guest.getByRole("button", { name: "Everyone" })).toBeVisible();

  /* ---------------------------------------------------------------- host download */

  const zip = await host.request.get(
    `/api/events/${host.url().split("/events/")[1].split("/")[0]}/download`,
  );
  expect(zip.status()).toBe(200);
  expect(zip.headers()["content-type"]).toContain("application/zip");

  await guestContext.close();
  await hostContext.close();
});
