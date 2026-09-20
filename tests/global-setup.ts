import "../scripts/load-env";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

import { purgeTestRolls } from "./purge-test-rolls";

export const TEST_HOST = {
  email: "playwright-host@memovue.test",
  name: "Playwright Host",
};

/**
 * A second account, which hosts nothing and is only ever invited to other people's rolls.
 *
 * Joining as an account holder cannot be tested with one user: a host's own roll is excluded
 * from the invited list by construction, so proving that a joined roll reaches somebody's
 * home screen needs somebody who is not the host.
 */
export const TEST_GUEST = {
  email: "playwright-guest@memovue.test",
  name: "Playwright Guest",
};

/**
 * Creating a roll spends one off the host's beta allowance, so the suite seeds itself two:
 * one for the roll every other test shoots on, and one for the test that spends the last,
 * gets refused, and deletes an unstarted roll to get it back.
 */
const TEST_ROLL_ALLOWANCE = 2;

export const STORAGE_STATE = path.join("tests", ".auth", "host.json");
export const GUEST_STORAGE_STATE = path.join("tests", ".auth", "invited.json");

/**
 * Clears the last run's wreckage, seeds the accounts, and hands the suite their signed
 * session cookies.
 *
 * Sign-in is Google now, and a browser cannot complete a real OAuth round trip in CI. The
 * alternative — keeping a password column so tests can log in through a form — would be a
 * backdoor into production with a friendly name. So the tests do what the callback route
 * does at the end: mint the same cookie, using the same secret, for a user we created.
 */
export default async function globalSetup() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    /*
      On the way in, not only on the way out.

      A run that fails half way leaves its rolls behind, and the next run then trips over
      them: two "Playwright Roll" cards on a home screen is a strict-mode violation, so the
      suite reports a duplicate-name failure for a bug nobody wrote. Cleaning first means a
      suite can only ever be poisoned by itself, and `cleanup:test` goes back to being the
      manual door rather than a step somebody has to remember.
    */
    const { rolls } = await purgeTestRolls(prisma, TEST_HOST.email);
    if (rolls > 0) console.log(`Cleared ${rolls} roll(s) left behind by an earlier run.`);

    const secret = new TextEncoder().encode(
      process.env.AUTH_SECRET ?? "memovue-dev-secret-not-for-production",
    );
    const baseUrl = new URL(process.env.TEST_BASE_URL ?? "http://localhost:3000");

    await mkdir(path.dirname(STORAGE_STATE), { recursive: true });

    for (const [account, file] of [
      [TEST_HOST, STORAGE_STATE],
      [TEST_GUEST, GUEST_STORAGE_STATE],
    ] as const) {
      const user = await prisma.user.upsert({
        where: { email: account.email },
        create: { email: account.email, name: account.name },
        // `role` is reset, not just seeded: the referrals spec borrows ADMIN for one test and
        // hands it back, and a run killed in the middle would otherwise leave a test host with
        // no beta allowance to spend, which is a different suite failing for no visible reason.
        update: { name: account.name, role: "HOST" },
        select: { id: true, tokenVersion: true },
      });

      const token = await new SignJWT({ tv: user.tokenVersion })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user.id)
        .setIssuedAt()
        .setExpirationTime("30d")
        .sign(secret);

      await writeFile(
        file,
        JSON.stringify({
          cookies: [
            {
              name: "mv_host",
              value: token,
              domain: baseUrl.hostname,
              path: "/",
              httpOnly: true,
              secure: baseUrl.protocol === "https:",
              sameSite: "Lax",
              expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
            },
          ],
          origins: [],
        }),
        "utf8",
      );
    }

    /*
      Reset rather than increment: the previous run spent this down to zero, and a suite that
      starts with whatever the last one left behind fails differently every time.

      `refunds` is on the same footing and was missed when the give-back grew a cap. One
      refund per account is the rule, the suite spends its one every run, and a counter that
      is never put back means every run after the first is asserting against an account that
      has already used it up.
    */
    await prisma.betaAccess.upsert({
      where: { email: TEST_HOST.email },
      create: { email: TEST_HOST.email, rollsLeft: TEST_ROLL_ALLOWANCE },
      update: { rollsLeft: TEST_ROLL_ALLOWANCE, refunds: 0 },
    });
  } finally {
    await prisma.$disconnect();
  }
}
