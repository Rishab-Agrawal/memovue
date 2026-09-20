import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { expect, test } from "@playwright/test";

/**
 * What a presigned upload URL actually promises R2.
 *
 * Nothing here imports `storage.ts`: that module reads credentials at import time and throws
 * without a configured bucket. What it pins is the assumption underneath `presignUpload` —
 * that a header only binds the request if the signer was told to sign it.
 *
 * Worth a test of its own because the failure is silent, and it already happened once.
 * `ContentType` was passed to `PutObjectCommand` from the first version of that function and
 * the comment above it said the URL was "locked to the exact content type the client
 * declared". It was not: SigV4 query-presigning signs `host` and nothing else unless
 * `signableHeaders` names more, so the URL took any body of any type. Nothing at the call
 * site looked wrong, and no test could have caught it, because the parameter was right there.
 *
 * Fake credentials and no network — `getSignedUrl` computes the signature locally.
 */
const client = new S3Client({
  region: "auto",
  endpoint: "https://account.r2.cloudflarestorage.com",
  credentials: { accessKeyId: "test-key", secretAccessKey: "test-secret" },
});

const command = () =>
  new PutObjectCommand({
    Bucket: "memovue",
    Key: "dev/roll/photo/secret/full.jpg",
    ContentType: "image/jpeg",
    ContentLength: 1024,
  });

function signedHeaders(url: string): string[] {
  return (new URL(url).searchParams.get("X-Amz-SignedHeaders") ?? "").split(";");
}

test.describe("a presigned upload URL", () => {
  test("binds nothing but the host unless it is asked to", async () => {
    /*
      A URL signed without the type is a blank cheque for that key — any body, any type — and
      the public image domain serves whatever was uploaded to it.

      The type is the one header the signer will never volunteer, so it has to be asked for.
      `ContentLength` does pull one in on its own, which makes a half-bound URL look bound.
    */
    const typeOnly = new PutObjectCommand({
      Bucket: "memovue",
      Key: "dev/roll/photo/secret/full.jpg",
      ContentType: "image/jpeg",
    });

    expect(signedHeaders(await getSignedUrl(client, typeOnly, { expiresIn: 600 }))).toEqual([
      "host",
    ]);
    expect(signedHeaders(await getSignedUrl(client, command(), { expiresIn: 600 }))).not.toContain(
      "content-type",
    );
  });

  test("binds the type and the length when it is", async () => {
    const url = await getSignedUrl(client, command(), {
      expiresIn: 600,
      signableHeaders: new Set(["content-type", "content-length"]),
    });

    const headers = signedHeaders(url);
    // The length is the half that costs money: without it a reserved shot is a URL somebody
    // can park five gigabytes against and then walk away from.
    expect(headers).toContain("content-length");
    // The type is what stops the public image domain serving whatever was sent to it.
    expect(headers).toContain("content-type");
  });
});
