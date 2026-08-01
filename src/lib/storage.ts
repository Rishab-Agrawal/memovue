import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "./env";

/**
 * Photos go browser → R2 directly via presigned URLs, so image bytes never touch the
 * app server. Only the host's "download everything" ZIP streams through us.
 *
 * Dev and production share one bucket but are separated by key prefix, so local testing
 * can't collide with a real event's album.
 */

let client: S3Client | null = null;

function s3(): S3Client {
  if (!env.r2) {
    throw new Error(
      "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET.",
    );
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: env.r2.endpoint,
      credentials: {
        accessKeyId: env.r2.accessKeyId,
        secretAccessKey: env.r2.secretAccessKey,
      },
    });
  }
  return client;
}

function bucket(): string {
  if (!env.r2) throw new Error("R2 is not configured.");
  return env.r2.bucket;
}

const prefix = env.isProduction ? "events" : "dev";

export type PhotoVariant = "full" | "preview";

export function photoKey(eventId: string, photoId: string, variant: PhotoVariant): string {
  return `${prefix}/${eventId}/${photoId}/${variant}.jpg`;
}

/** Short-lived upload URL, locked to the exact content type the client declared. */
export function presignUpload(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn: 600 },
  );
}

/**
 * Read URLs are signed per request rather than making the bucket public, so a leaked
 * album link stops working instead of exposing the whole event forever.
 */
export function presignDownload(
  key: string,
  { expiresIn = 3600, filename }: { expiresIn?: number; filename?: string } = {},
): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ...(filename
        ? { ResponseContentDisposition: `attachment; filename="${filename}"` }
        : {}),
    }),
    { expiresIn },
  );
}

export async function getObjectStream(key: string) {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return res.Body;
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  // DeleteObjects caps out at 1000 keys per call.
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    await s3().send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}

export const storageConfigured = env.r2 !== null;
