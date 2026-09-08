import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import type { PrismaClient } from "@prisma/client";

/**
 * Everything the Playwright suite has ever created, with its objects.
 *
 * The suite creates real rolls and uploads real photographs on every run, so without this the
 * database and the bucket accumulate junk. It runs from `global-setup` rather than only from
 * the `cleanup:test` script, because a run that crashes half way through leaves rolls behind
 * and the *next* run then fails on them — a second "Playwright Roll" on the home screen is a
 * strict-mode violation, so the suite reports a duplicate-name error for a bug that does not
 * exist. Cleaning on the way in means a suite can only ever be poisoned by itself.
 *
 * Nothing here touches the test accounts: the suite expects those to exist, and `global-setup`
 * is what keeps them right.
 */
export async function purgeTestRolls(
  prisma: PrismaClient,
  hostEmail: string,
): Promise<{ rolls: number; objects: number }> {
  const rolls = await prisma.roll.findMany({
    where: { host: { email: hostEmail } },
    select: { id: true },
  });
  if (rolls.length === 0) return { rolls: 0, objects: 0 };

  const rollIds = rolls.map((roll) => roll.id);
  const photos = await prisma.photo.findMany({
    where: { rollId: { in: rollIds } },
    select: { fullKey: true, previewKey: true },
  });

  // Covers as well as photos: a roll can carry an uploaded cover, and it lives in the
  // bucket under its own key rather than as a Photo row.
  const covers = await prisma.roll.findMany({
    where: { id: { in: rollIds }, coverKey: { not: null } },
    select: { coverKey: true },
  });

  const keys = [
    ...photos.flatMap((photo) => [photo.fullKey, photo.previewKey]),
    ...covers.map((roll) => roll.coverKey!),
  ];

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
  return { rolls: rolls.length, objects: keys.length };
}
