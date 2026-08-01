/**
 * Applies the bucket-level configuration MemoVue needs on R2.
 *
 * Browsers PUT photo bytes straight at R2, so the bucket must allow cross-origin PUTs
 * from wherever the app is served. Re-run this after adding a new domain.
 *
 *   npx tsx scripts/setup-r2.ts
 */
import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
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

const origins = [
  "http://localhost:3000",
  "https://memovue.com",
  "https://www.memovue.com",
  ...(process.env.APP_URL && !process.env.APP_URL.includes("localhost")
    ? [process.env.APP_URL.replace(/\/$/, "")]
    : []),
  ...(process.env.EXTRA_CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? []),
];

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

async function main() {
  const allowed = [...new Set(origins)];

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: allowed,
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["content-type"],
            ExposeHeaders: ["etag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );

  console.log(`CORS applied to bucket "${bucket}" for:\n  ${allowed.join("\n  ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
