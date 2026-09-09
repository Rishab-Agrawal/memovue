/**
 * Removes rolls created by the Playwright suite, along with their R2 objects.
 *
 * The suite now does this for itself on the way in, so this is the manual door: clearing a
 * machine down without running the tests. The test host account itself is kept — the suite
 * expects it to exist.
 *
 *   npx tsx scripts/cleanup-test-data.ts
 */
import "./load-env";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { TEST_HOST } from "../tests/global-setup";
import { purgeTestRolls } from "../tests/purge-test-rolls";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const { rolls, objects } = await purgeTestRolls(prisma, TEST_HOST.email);
    console.log(
      rolls === 0 ? "Nothing to clean up." : `Removed ${rolls} test event(s) and ${objects} object(s).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
