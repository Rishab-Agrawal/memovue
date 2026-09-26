import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { STORAGE_STATE, TEST_HOST } from "./global-setup";

/**
 * The admin side of referral codes, which is the half with no other cover.
 *
 * Everything a business code carries is editable after it exists — the code string included, because a
 * business renames itself and a typo on Tuesday should not retire a code already printed on
 * somebody's cards. What makes that worth a browser rather than a unit test is that the edit
 * has to land on the same row: the rolls already created point at an id, and an "edit" that
 * quietly minted a second business would take the credit off every one of them.
 *
 * It also carries the only upload in the app that goes through the server rather than past it,
 * so the file leaving a picker and arriving in the bucket is checked here or nowhere.
 *
 * The test host is promoted for the duration and demoted in `finally`; `global-setup` resets
 * the role as well, so a run killed mid-test cannot leave an admin behind.
 */
test.use({ storageState: STORAGE_STATE });

test("business and individual codes are minted, and a business code edited in place", async ({
  page,
}) => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  await prisma.user.update({ where: { email: TEST_HOST.email }, data: { role: "ADMIN" } });
  await prisma.referrer.deleteMany({ where: { code: { in: ["PWTEST1", "PWTEST2", "PWTEST3"] } } });

  try {
    await page.goto("/admin/referrals");
    const businesses = page.locator("section", {
      has: page.getByRole("heading", { name: "Businesses" }),
    });
    const individuals = page.locator("section", {
      has: page.getByRole("heading", { name: "Individuals" }),
    });

    // One roll, whatever is posted, and minted before anybody has been chosen to get it.
    await individuals.getByLabel("Code (optional)").fill("pwtest3");
    // Nowhere to send it yet, so sending is not offered.
    await expect(individuals.getByRole("switch")).toHaveCount(0);
    await individuals.getByRole("button", { name: "Create this code" }).click();
    const row = individuals.getByRole("listitem").filter({ hasText: "PWTEST3" });
    await expect(row.getByText("Not given to anybody yet")).toBeVisible();
    const individual = await prisma.referrer.findUniqueOrThrow({ where: { code: "PWTEST3" } });
    expect(individual).toMatchObject({ kind: "INDIVIDUAL", maxUses: 1, name: null, email: null });

    // Given to somebody later, on the same row. Sending is left off: this is a real mailer.
    await individuals.getByRole("button", { name: "Edit PWTEST3" }).click();
    await individuals.getByLabel("Email (optional)").fill("person@playwright.test");
    await expect(individuals.getByRole("switch")).toBeVisible();
    await individuals.getByRole("button", { name: "Save changes" }).click();
    await expect(row.getByText("person@playwright.test")).toBeVisible();
    const given = await prisma.referrer.findUniqueOrThrow({ where: { code: "PWTEST3" } });
    expect(given).toMatchObject({ id: individual.id, email: "person@playwright.test" });

    // Typed as it was written on a card; stored in the form a roll code is stored in.
    await businesses.getByLabel("Code", { exact: true }).fill("pwtest-1");
    await businesses.getByLabel("Rolls allowed").fill("25");
    await page.getByLabel("Business name").fill("Playwright Florals");
    await page.getByLabel("Website (optional)").fill("https://playwright-florals.test");
    await page.getByLabel("Email for new rolls (optional)").fill("partner@playwright.test");
    await page.locator('input[type="file"]').setInputFiles("public/icon-512.png");
    await expect(page.getByText("Image ready")).toBeVisible();

    await businesses.getByRole("button", { name: "Create this code" }).click();
    await expect(page.getByRole("button", { name: "Edit Playwright Florals" })).toBeVisible();

    const created = await prisma.referrer.findUniqueOrThrow({ where: { code: "PWTEST1" } });
    expect(created.email).toBe("partner@playwright.test");
    expect(created).toMatchObject({ kind: "BUSINESS", maxUses: 25 });
    // The bytes left the picker, were shrunk, and landed under this business's own key.
    expect(created.logoUrl).toContain(`/referrers/${created.id}/logo.jpg?v=`);

    await page.getByRole("button", { name: "Edit Playwright Florals" }).click();
    await expect(page.getByText("Editing PWTEST1")).toBeVisible();

    await businesses.getByLabel("Code", { exact: true }).fill("PWTEST2");
    await businesses.getByLabel("Rolls allowed").fill("30");
    await page.getByLabel("Business name").fill("Playwright Weddings");
    await page.getByLabel("Email for new rolls (optional)").fill("");
    await page.getByRole("button", { name: "Save changes" }).click();

    // The list row, not the form's live preview: only a finished save redraws the list.
    await expect(page.getByRole("button", { name: "Edit Playwright Weddings" })).toBeVisible();

    const edited = await prisma.referrer.findUniqueOrThrow({ where: { code: "PWTEST2" } });
    expect(edited.id).toBe(created.id);
    expect(edited.name).toBe("Playwright Weddings");
    expect(edited.maxUses).toBe(30);
    // Cleared means cleared: an empty address stops the mail rather than storing "".
    expect(edited.email).toBeNull();
    // Untouched by an edit that did not pick a new one.
    expect(edited.logoUrl).toBe(created.logoUrl);

    /*
      The sample album's card: set from the account screen, shown on the admin copy only.

      Three things have to hold at once, and each of them is a way this feature goes wrong. The
      pitch copy carries the card. The copy every host opens does not, or a made-up florist is
      advertising on the sample. And the reserved code resolves for nobody, or a host who types
      SAMPLE gets that florist on their own wedding.
    */
    await page.goto("/admin/sample");
    await page.getByLabel("Business name").fill("Pitch Florals");
    await page.getByRole("button", { name: "Save this card" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.goto("/admin/sample/album");
    await expect(page.getByText("Pitch Florals")).toBeVisible();
    // Nothing that says "admin" may be in the frame, and the gear is the only candidate.
    await expect(page.getByRole("link", { name: "Roll settings" })).toHaveCount(0);

    await page.goto("/albums/sample");
    await expect(page.getByText("Pitch Florals")).toHaveCount(0);

    await page.goto("/new/name");
    await page.getByLabel("Event name").fill("Not a pitch");
    await page.goto("/new/guests");
    await page.getByRole("button", { name: /Create/ }).click();
    await page.getByLabel("Referral code", { exact: true }).fill("SAMPLE");
    await page.getByRole("button", { name: "Create roll", exact: true }).click();
    await expect(page.getByText("Code not found, please re-check.")).toBeVisible();
  } finally {
    await prisma.referrer.deleteMany({ where: { code: "SAMPLE" } });
    await prisma.referrer.deleteMany({ where: { code: { in: ["PWTEST1", "PWTEST2", "PWTEST3"] } } });
    await prisma.user.update({ where: { email: TEST_HOST.email }, data: { role: "HOST" } });
    await prisma.$disconnect();
  }
});
