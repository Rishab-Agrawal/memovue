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

/** Creating a roll costs a code, so the suite needs one waiting for it. */
export const TEST_COUPON = "PLAYWRGHT";

export const STORAGE_STATE = path.join("tests", ".auth", "host.json");

/**
 * Seeds a host and hands the suite a signed session cookie.
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
    const user = await prisma.user.upsert({
      where: { email: TEST_HOST.email },
      create: { email: TEST_HOST.email, name: TEST_HOST.name },
      update: { name: TEST_HOST.name },
      select: { id: true, tokenVersion: true },
    });

    // Reset rather than upsert: a coupon is single-use, so a run that already spent it has
    // to get a fresh one or every subsequent run fails at roll creation.
    await prisma.coupon.deleteMany({ where: { code: TEST_COUPON } });
    await prisma.coupon.create({ data: { code: TEST_COUPON, note: "playwright" } });

    const secret = new TextEncoder().encode(
      process.env.AUTH_SECRET ?? "memovue-dev-secret-not-for-production",
    );

    const token = await new SignJWT({ tv: user.tokenVersion })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secret);

    const baseUrl = new URL(process.env.TEST_BASE_URL ?? "http://localhost:3000");

    await mkdir(path.dirname(STORAGE_STATE), { recursive: true });
    await writeFile(
      STORAGE_STATE,
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
  } finally {
    await prisma.$disconnect();
  }
}
