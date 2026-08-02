/**
 * Round-trips a throwaway object through R2 using whatever credentials are configured:
 * presign an upload, PUT to it, presign a read, GET it back, compare, delete.
 *
 * Exercises exactly the operations the app performs at runtime, so it confirms a
 * bucket-scoped Object token is sufficient before the account-scoped one is revoked.
 *
 *   npx tsx scripts/verify-r2.ts
 */
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  throw new Error("R2 environment variables are not set — see .env.example");
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

async function main() {
  const key = `healthcheck/${Date.now()}.jpg`;
  const payload = `memovue r2 check ${new Date().toISOString()}`;

  console.log(`bucket        ${bucket}`);
  console.log(`access key    ${accessKeyId!.slice(0, 8)}…`);

  const putUrl = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: "image/jpeg" }),
    { expiresIn: 120 },
  );
  const put = await fetch(putUrl, {
    method: "PUT",
    body: payload,
    headers: { "content-type": "image/jpeg" },
  });
  if (!put.ok) throw new Error(`presigned PUT failed: ${put.status}`);
  console.log("presigned PUT  ok");

  const getUrl = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 120 },
  );
  const got = await fetch(getUrl);
  if (!got.ok) throw new Error(`presigned GET failed: ${got.status}`);
  if ((await got.text()) !== payload) throw new Error("round-tripped body did not match");
  console.log("presigned GET  ok");

  // The host's ZIP download streams objects through the SDK rather than a signed URL, so
  // check that path too.
  const direct = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!direct.Body) throw new Error("direct GET returned no body");
  console.log("direct GET     ok");

  await client.send(
    new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: [{ Key: key }], Quiet: true } }),
  );
  console.log("delete         ok");

  console.log("\nAll runtime operations succeeded with these credentials.");
}

main().catch((error) => {
  console.error(`\nFAILED: ${(error as Error).message}`);
  process.exit(1);
});
