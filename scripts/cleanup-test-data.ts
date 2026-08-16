/**
 * Removes rolls created by the Playwright suite, along with their R2 objects.
 *
 * The suite creates a real event and uploads real photos on every run, so without this the
 * database and bucket accumulate junk. The test host account itself is kept — the suite
 * expects it to exist.
 *
 *   npx tsx scripts/cleanup-test-data.ts
 */
import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const TEST_HOST_EMAIL = "playwright-host@memovue.test";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const rolls = await prisma.roll.findMany({
      where: { host: { email: TEST_HOST_EMAIL } },
      select: { id: true, name: true },
    });

    if (rolls.length === 0) {
      console.log("Nothing to clean up.");
      return;
    }

    const rollIds = rolls.map((roll) => roll.id);
    const photos = await prisma.photo.findMany({
      where: { rollId: { in: rollIds } },
      select: { fullKey: true, previewKey: true },
    });

    const keys = photos.flatMap((photo) => [photo.fullKey, photo.previewKey]);

    if (keys.length > 0 && process.env.R2_ACCOUNT_ID) {
      const client = new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      });

      for (let i = 0; i < keys.length; i += 1000) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: process.env.R2_BUCKET!,
            Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
          }),
        );
      }
    }

    await prisma.roll.deleteMany({ where: { id: { in: rollIds } } });
    console.log(`Removed ${rolls.length} test event(s) and ${keys.length} object(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
