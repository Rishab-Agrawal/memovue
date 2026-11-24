import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { TEST_HOST } from "./global-setup";

/**
 * A guest who scans the night before. They join, wait at a dimmed camera, and the live one
 * arrives when the roll starts, without a reload. Revealed as it is shot, because that mode once
 * let guests in early while the other two refused them.
 */
test("a guest who joins early gets the camera when the roll starts", async ({ browser }) => {
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
      code: "PWERLY",
      name: "Playwright Early",
      revealMode: "DURING",
      startsAt: new Date(now + 86_400_000),
      finishesAt: new Date(now + 2 * 86_400_000),
      revealAt: new Date(now + 2 * 86_400_000),
      keptUntil: new Date(now + 32 * 86_400_000),
    },
  });

  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.clock.install();
  try {
    await page.goto(`/join/${roll.code}`);
    await expect(page.getByText(/^Opens /)).toBeVisible();
    await page.getByPlaceholder("Enter your name").fill("Early");
    await page.getByRole("button", { name: /Join roll/ }).click();

    await expect(page).toHaveURL(/\/album$/);
    await expect(page.getByRole("button", { name: "Take a photo" })).toBeDisabled();

    await prisma.roll.update({ where: { id: roll.id }, data: { startsAt: new Date() } });
    await page.clock.runFor(20_000);
    await expect(page.getByRole("link", { name: "Take a photo" })).toBeVisible();
  } finally {
    await context.close();
    await prisma.roll.delete({ where: { id: roll.id } });
    await prisma.$disconnect();
  }
});
