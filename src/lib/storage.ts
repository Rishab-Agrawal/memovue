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

/**
 * Where one photograph lives, and — since the bucket went behind a public cached domain —
 * the thing that decides who can read it.
 *
 * The `secret` segment is the whole point. This key used to be `{rollId}/{photoId}/{variant}`,
 * derivable from two values a guest legitimately holds: the roll id, which is printed inside
 * every upload URL they are issued, and the photo ids of *everyone* in the roll, which the
 * sealed wall hands out so it can draw one blurred tile per frame. Anybody who had taken a
 * single photograph could therefore assemble the URL of any other guest's full-resolution
 * original and fetch it straight off the CDN — before the reveal, and regardless of whether
 * the host had opened the roll to everyone. That is the product's one promise, and it was
 * open for a day.
 *
 * With a random segment the key is a capability rather than an address: holding it *is* the
 * authorisation, and it is only ever handed out by a route that has already checked the
 * seal and the ownership rule. Guessing is 21 random characters against no oracle.
 *
 * Generated once, at reservation, and stored — `fullKey` and `previewKey` are columns, so this
 * is never recomputed and photographs taken before this existed keep working.
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
  return `${prefix}/zips/${rollId}-${opaque("zip", rollId)}.zip`;
}

/**
 * An unguessable but reproducible suffix, so a key can stay a pure function of the roll and
 * still not be derivable by someone holding only the roll id.
 *
 * The archive needed this more urgently than any single photograph did: it sat at
 * `zips/{rollId}.zip`, and a roll id is inside every upload URL we hand a guest — so one guest
 * could have pulled down the entire album, every photographer's frames, in one request, the
 * moment a host built it.
 *
 * ponytail: derived from AUTH_SECRET rather than stored, so there is no column and no second
 * copy of a fact. The ceiling is that rotating AUTH_SECRET orphans any archive built before
 * the rotation — unreachable to everyone, but also invisible to `purgeRoll`, which is data
 * outliving its deletion date. Store the key on the roll if you ever need to rotate.
 */
function opaque(scope: string, id: string): string {
  return createHmac("sha256", env.authSecret).update(`${scope}:${id}`).digest("base64url").slice(0, 24);
}

/** The pre-capability archive key. Only still referenced so a purge can clean one up. */
export function legacyZipKey(rollId: string): string {
  return `${prefix}/zips/${rollId}.zip`;
}

/**
 * Short-lived upload URL, locked to the exact content type *and* the exact byte count.
 *
 * `signableHeaders` is the whole of it, and it was missing. SigV4 query-presigning signs
 * `host` and nothing else unless it is told otherwise — so despite `ContentType` being passed
 * here since the first version, `X-Amz-SignedHeaders` read `host`, and the URL accepted any
 * body of any type. Two things followed from that, and both cost money:
 *
 *   A presigned PUT cannot express a length range, so the size was checked *after* the bytes
 *   landed, on the confirm. Anything that never confirmed was never checked at all: a guest
 *   could park five gigabytes against each of their reserved shots and simply walk away, and
 *   it sat in the bucket until the sweep took it a week later. Worse, the URL stays valid for
 *   ten minutes after a confirm has passed the size check, so the object that was measured
 *   could be replaced by one that never would have been.
 *
 *   And the content type the caller sent was stored as the object's own, on a bucket served
 *   through a public Cloudflare domain — which made `img.memovue.com` a file host for
 *   whatever anyone who had joined a roll cared to upload, HTML included.
 *
 * Signing both pushes the check to where the bytes actually arrive: R2 refuses the PUT with a
 * signature mismatch rather than storing something for us to regret. The client knows the
 * exact size of the blob before it asks for the URL, so pinning it costs the caller nothing.
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
 * A stable, cacheable URL for an object, through the Cloudflare custom domain in front of
 * the bucket. **This is how every image in the app is served.**
 *
 * The presigned alternative could not be cached by anything. It points at the S3 API
 * endpoint, which is not a Cloudflare zone and has no CDN in front of it, and the signature
 * is minted per request — so even the browser treated each render as a new URL. Every tile,
 * for every guest, on every visit was a billed read, a term growing as guests x photos. The
 * cover was worse: the feed poll re-signed it every twenty seconds, so a guest on mobile
 * data re-downloaded the same unchanged picture a hundred and eighty times an hour.
 *
 * A cache hit never reaches R2, so viewing an album is free however often it is opened.
 *
 * What this trades: an image URL no longer expires. It stays valid until the roll is purged,
 * guarded by the key being unguessable rather than by a clock. That is deliberate, and it is
 * not what enforces the seal — the seal has always been enforced by refusing to hand out a
 * URL at all, never by the URL going stale.
 */
export function publicUrl(key: string): string {
  if (!env.r2) throw new Error("R2 is not configured.");
  return `${env.r2.publicUrl}/${key}`;
}

/**
 * A signed, expiring URL. One caller: the album ZIP.
 *
 * Everything a guest looks at comes from `publicUrl`, and so does everything they save — the
 * viewer reads a photograph into a blob and names the file itself, which is what let the
 * saved copy come off the cache too. The archive is the one object that stays signed: it is
 * fetched once, it is far too large for the edge to cache, and it is the only thing in the
 * bucket that is worth putting behind a clock, being an entire wedding in one file.
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

/**
 * Guarded here rather than at each call site, because one of them forgot.
 *
 * Every other caller asks `storageConfigured` first; the route that hands a rejected frame's
 * shot back does not, so on a deploy without a bucket it threw instead of releasing — and the
 * queue reads a throw as transient, so it retried forever and the guest stayed a shot short.
 * Deleting nothing from a bucket that does not exist is the right answer everywhere.
 */
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
