import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

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

/**
 * A roll's cover, at a fixed key so re-uploading overwrites in place.
 *
 * Deliberately not `covers/{rollId}/{nanoid}.jpg`: a unique key per upload means every
 * replaced cover leaves an object nobody will ever delete, and the only way to find those
 * again is a sweeper that does not exist. Signed read URLs carry a fresh signature on every
 * request, so a browser never serves the previous image from cache despite the stable key.
 *
 * The client never supplies this — both the upload and the confirm recompute it from the
 * roll id, so there is no key for a request to point somewhere it shouldn't.
 */
export function coverKey(rollId: string): string {
  return `${prefix}/covers/${rollId}/cover.jpg`;
}

/**
 * The host's archive of a finished roll, at a fixed key so it is built once and then simply
 * handed out. Derived from the roll id like `coverKey`, never supplied by a caller.
 *
 * Deliberately not stored in a column: the key is a pure function of the roll, and whether
 * the object exists is a question R2 can already answer with a HEAD. A `zipKey` column would
 * be a second copy of a fact, and the two would eventually disagree.
 */
export function zipKey(rollId: string): string {
  return `${prefix}/zips/${rollId}.zip`;
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

/**
 * Size and type of an object that was uploaded straight to R2.
 *
 * A presigned PUT pins the content type but cannot cap the body — S3 only enforces a length
 * range through POST policies, which presigned PUTs don't have. So the confirm step measures
 * what actually landed instead of trusting what the client said it would send. Returns null
 * if the object isn't there.
 */
export async function headObject(key: string): Promise<{ bytes: number } | null> {
  try {
    const res = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { bytes: res.ContentLength ?? 0 };
  } catch {
    return null;
  }
}

export async function getObjectStream(key: string) {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return res.Body;
}

/**
 * Streams a body of unknown length into R2.
 *
 * A plain PutObject needs a Content-Length up front, which an archive being generated does
 * not have, and R2 refuses a single upload over about 5 GiB anyway. `Upload` splits the
 * stream into parts and completes the multipart for us, so a 12,000-photo ZIP costs a few
 * dozen operations rather than a buffer the size of the wedding.
 */
export async function putStream(
  key: string,
  body: Readable,
  contentType: string,
): Promise<void> {
  await new Upload({
    client: s3(),
    params: { Bucket: bucket(), Key: key, Body: body, ContentType: contentType },
    partSize: 64 * 1024 * 1024,
    queueSize: 2,
  }).done();
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
