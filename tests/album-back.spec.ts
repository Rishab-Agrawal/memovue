import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { STORAGE_STATE, TEST_HOST } from "./global-setup";

/**
 * Where a roll's back arrow goes.
 *
 * It used to always be Home, which was right while every roll was running and wrong the moment
 * the Albums tab existed: opening a finished album from Albums and pressing back landed on Home,
 * which reads as the app having lost your place. The arrow now points at the tab the roll is
 * actually listed in, which is a fact about the roll rather than about how you arrived — there
 * is no history to consult when the link is rendered on the server.
 *
 * Both rolls are written straight to the database: the wizard will not create a roll that has
 * already finished, which is exactly the case that was broken.
 */
test.use({ storageState: STORAGE_STATE });

test("a finished roll goes back to Albums, a running one to Home", async ({ page }) => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const host = await prisma.user.findUniqueOrThrow({ where: { email: TEST_HOST.email } });
  const now = Date.now();
  const shared = { hostId: host.id, maxGuests: 50, photosPerGuest: 24 };

  const running = await prisma.roll.create({
    data: {
      ...shared,
      code: "PWBAK1",
      name: "Playwright Running",
      startsAt: new Date(now - 3_600_000),
      finishesAt: new Date(now + 86_400_000),
      revealAt: new Date(now + 86_400_000),
      keptUntil: new Date(now + 30 * 86_400_000),
    },
  });
  const finished = await prisma.roll.create({
    data: {
      ...shared,
      code: "PWBAK2",
      name: "Playwright Finished",
      startsAt: new Date(now - 200_000_000),
      finishesAt: new Date(now - 100_000_000),
      revealAt: new Date(now - 100_000_000),
      keptUntil: new Date(now + 30 * 86_400_000),
    },
  });

  try {
    await page.goto(`/rolls/${finished.id}`);
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/albums$/);

    await page.goto(`/rolls/${running.id}`);
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/rolls$/);
  } finally {
    await prisma.roll.deleteMany({ where: { id: { in: [running.id, finished.id] } } });
    await prisma.$disconnect();
  }
});
