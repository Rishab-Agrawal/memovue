import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { type Browser, type Page, expect, test } from "@playwright/test";

import { TEST_HOST } from "./global-setup";

/**
 * The film a guest is offered, wherever they are offered it. Offered too much, every extra frame
 * is refused by the server and deleted by the queue, so these numbers are photographs.
 */

const PHOTO = "public/covers/trip.jpg";

/** A five-shot roll, open to the library, and a guest standing in its camera. */
async function joined(
  browser: Browser,
  code: string,
  run: (page: Page) => Promise<void>,
  closesIn = 86_400_000,
) {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const host = await prisma.user.findUniqueOrThrow({ where: { email: TEST_HOST.email } });
  const now = Date.now();
  const roll = await prisma.roll.create({
    data: {
      hostId: host.id,
      maxGuests: 50,
      photosPerGuest: 5,
      uploadsAllowed: true,
      code,
      name: "Playwright Film Left",
      startsAt: new Date(now - 3_600_000),
      finishesAt: new Date(now + closesIn),
      revealAt: new Date(now + 86_400_000),
      keptUntil: new Date(now + 30 * 86_400_000),
    },
  });

  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  // A phone set an hour slow. Every deadline is the server's.
  await page.clock.install({ time: now - 3_600_000 });
  try {
    await page.goto(`/join/${code}`);
    await page.getByPlaceholder("Enter your name").fill("Film");
    await page.getByRole("button", { name: /Join roll/ }).click();
    await expect(page.getByTestId("shots-left")).toHaveText("5");
    await run(page);
  } finally {
    await context.close();
    await prisma.roll.delete({ where: { id: roll.id } });
    await prisma.$disconnect();
  }
}

// The browser's back replays the camera's first render, count and all.
test("back into the camera shows the server's count", async ({ browser }) => {
  await joined(browser, "PWCAM1", async (page) => {
    for (const left of ["4", "3", "2"]) {
      await page.getByRole("button", { name: "Take photo" }).click();
      await expect(page.getByTestId("shots-left")).toHaveText(left);
    }

    await page.getByRole("button", { name: "Open the roll" }).click();
    await expect(page).toHaveURL(/\/album$/);
    await expect(page.getByRole("button", { name: "Photo by You" })).toHaveCount(3, {
      timeout: 60_000,
    });

    await page.goBack();
    await expect(page.getByTestId("shots-left")).toHaveText("2");
    await page.getByRole("button", { name: "Take photo" }).click();
    await expect(page.getByTestId("shots-left")).toHaveText("1");
  });
});

// Reserved frames leave the queue before the album's count is polled again.
test("uploads that land do not hand their film back", async ({ browser }) => {
  await joined(browser, "PWCAM2", async (page) => {
    await page.getByRole("button", { name: "Open the roll" }).click();
    await expect(page).toHaveURL(/\/album$/);

    const library = page.locator("input[type=file]");
    await library.setInputFiles([PHOTO, PHOTO, PHOTO]);
    await expect(page.getByRole("button", { name: "Photo by You" })).toHaveCount(3, {
      timeout: 60_000,
    });

    await library.setInputFiles([PHOTO, PHOTO, PHOTO]);
    await expect(page.getByText("You can only upload 2 photos!")).toBeVisible();
  });
});

// Requests sent together all see the same film unless the server makes them take turns.
test("reservations never pass the allowance, however they are asked for", async ({ browser }) => {
  await joined(browser, "PWCAM3", async (page) => {
    const reserve = (clientId: string) =>
      page.request.post("/api/r/PWCAM3/photos", {
        data: { contentType: "image/jpeg", fullBytes: 1000, previewBytes: 500, clientId },
      });

    // One frame asked for twice at once, as a lost answer's retry or a second tab would.
    const twice = await Promise.all([reserve("frame"), reserve("frame")]);
    const [first, second] = await Promise.all(twice.map((response) => response.json()));
    expect(second.photoId).toBe(first.photoId);

    const rest = await Promise.all(Array.from({ length: 20 }, (_, i) => reserve(`frame-${i}`)));
    expect(rest.filter((response) => response.ok())).toHaveLength(4);
  });
});

test("the shutter closes on the server's clock", async ({ browser }) => {
  await joined(
    browser,
    "PWCAM4",
    async (page) => {
      await expect(page).toHaveURL(/\/album$/, { timeout: 40_000 });
    },
    25_000,
  );
});
