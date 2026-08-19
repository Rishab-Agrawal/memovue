import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { SignJWT } from "jose";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

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

/** Creating a roll costs a code, so the suite needs one waiting for it. */
export const TEST_COUPON = "PLAYWRGHT";

export const STORAGE_STATE = path.join("tests", ".auth", "host.json");
export const GUEST_STORAGE_STATE = path.join("tests", ".auth", "invited.json");

/**
 * Seeds the accounts and hands the suite their signed session cookies.
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
        update: { name: account.name },
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

    // Reset rather than upsert: a coupon is single-use, so a run that already spent it has
    // to get a fresh one or every subsequent run fails at roll creation.
    await prisma.coupon.deleteMany({ where: { code: TEST_COUPON } });
    await prisma.coupon.create({ data: { code: TEST_COUPON, note: "playwright" } });
  } finally {
    await prisma.$disconnect();
  }
}
