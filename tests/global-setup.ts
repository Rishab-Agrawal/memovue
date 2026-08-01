import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

export const TEST_HOST = {
  email: "playwright-host@memovue.test",
  password: "playwright-test-password",
  name: "Playwright Host",
};

/**
 * Guarantees an approved host exists before the suite runs, so tests don't have to go
 * through the manual beta-approval queue on every run.
 */
export default async function globalSetup() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const passwordHash = await bcrypt.hash(TEST_HOST.password, 10);
    await prisma.user.upsert({
      where: { email: TEST_HOST.email },
      create: {
        email: TEST_HOST.email,
        name: TEST_HOST.name,
        passwordHash,
        accessStatus: "APPROVED",
      },
      update: { passwordHash, accessStatus: "APPROVED" },
    });
  } finally {
    await prisma.$disconnect();
  }
}
