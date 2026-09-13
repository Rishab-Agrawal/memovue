import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createHmac } from "node:crypto";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

import { env } from "./env";

/**
 * Photos go browser → R2 directly via presigned URLs, so image bytes never touch the app
 * server. Only the host's ZIP streams through us. Dev and production share one bucket,
 * separated by key prefix.
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

/** Stated by `R2_PREFIX`, not inferred from NODE_ENV: `next start` says production on a laptop. */
const prefix = env.r2Prefix;

type PhotoVariant = "full" | "preview";

/**
 * Where one photograph lives. The random `secret` makes the key a capability: the bucket is
 * public behind a CDN, so holding the key is the authorisation, and only routes that have
 * checked the seal and ownership hand it out. Stored in columns, never recomputed.
 */
export function photoKey(
  eventId: string,
  photoId: string,
  secret: string,
  variant: PhotoVariant,
): string {
  return `${prefix}/${eventId}/${photoId}/${secret}/${variant}.jpg`;
}

/**
 * A roll's cover, at a fixed key so a replacement overwrites rather than orphans. The cache is
 * busted by `Roll.coverVersion` in the query string. Never supplied by the client.
 */
export function coverKey(rollId: string): string {
  return `${prefix}/covers/${rollId}/cover.jpg`;
}

/** The host's archive, at a key derived from the roll so it is built once and a purge can find it. */
export function zipKey(rollId: string): string {
  return `${prefix}/zips/${rollId}-${opaque("zip", rollId)}.zip`;
}

/**
 * A reproducible but unguessable suffix: roll ids are visible to every guest, so a key derived
 * from the id alone would hand out the whole album.
 *
 * ponytail: derived from AUTH_SECRET, so rotating it orphans existing archives from `purgeRoll`.
 * Store the key on the roll if you ever need to rotate.
 */
function opaque(scope: string, id: string): string {
  return createHmac("sha256", env.authSecret).update(`${scope}:${id}`).digest("base64url").slice(0, 24);
}

/** A night's database copy. Dated so rotation can delete by name without listing. */
export function backupKey(day: string): string {
  return `${prefix}/backups/${day}.ndjson.gz`;
}

/** The pre-capability archive key. Only still referenced so a purge can clean one up. */
export function legacyZipKey(rollId: string): string {
  return `${prefix}/zips/${rollId}.zip`;
}

/**
 * Short-lived upload URL locked to the exact content type and byte count.
 *
 * SigV4 presigning signs only `host` unless told otherwise, so without `signableHeaders` the URL
 * accepts any body of any type — an unbounded upload, and a public file host for HTML.
 */
export function presignUpload(
  key: string,
  contentType: string,
  bytes: number,
): Promise<string> {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: bytes,
    }),
    { expiresIn: 600, signableHeaders: new Set(["content-type", "content-length"]) },
  );
}

/**
 * A stable, CDN-cached URL. Every image in the app is served this way, so viewing an album
 * costs no R2 reads. It never expires; the seal is enforced by not handing it out.
 */
export function publicUrl(key: string): string {
  if (!env.r2) throw new Error("R2 is not configured.");
  return `${env.r2.publicUrl}/${key}`;
}

/** A signed, expiring URL. Only the album ZIP uses it: too large to cache, worth a clock. */
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

/** Size of an uploaded object, or null if it isn't there. */
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

/** Streams a body of unknown length into R2 as a multipart upload. */
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

/** A no-op without a bucket, so no caller has to remember to check `storageConfigured`. */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (!env.r2 || keys.length === 0) return;
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
