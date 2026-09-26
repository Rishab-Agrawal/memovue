import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { TEST_HOST } from "./global-setup";

/**
 * The browser's back into the camera replays its first render, count and all. Trusted, the
 * counter offers film already spent, and every extra frame is refused and deleted.
 */
test("back into the camera shows the server's count", async ({ browser }) => {
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
      code: "PWCAM1",
      name: "Playwright Camera Back",
      startsAt: new Date(now - 3_600_000),
      finishesAt: new Date(now + 86_400_000),
      revealAt: new Date(now + 86_400_000),
      keptUntil: new Date(now + 30 * 86_400_000),
    },
  });

  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  try {
    await page.goto(`/join/${roll.code}`);
    await page.getByPlaceholder("Enter your name").fill("Back");
    await page.getByRole("button", { name: /Join roll/ }).click();
    await expect(page.getByTestId("shots-left")).toHaveText("5");

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
  } finally {
    await context.close();
    await prisma.roll.delete({ where: { id: roll.id } });
    await prisma.$disconnect();
  }
});
