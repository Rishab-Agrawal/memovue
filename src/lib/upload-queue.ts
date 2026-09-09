import { type IDBPDatabase, openDB } from "idb";

import type { ProcessedPhoto } from "./image";

/**
 * Durable upload queue.
 *
 * Photos are written to IndexedDB the instant a guest taps "Use it", before any network
 * call. Venues have terrible wifi and people lock their phones mid-upload; a shot that
 * only lived in memory would be gone. Anything still queued is retried on the next app
 * open, or the moment the device comes back online.
 */

const DB_NAME = "memovue";
const STORE = "uploads";

interface QueuedPhoto {
  localId: string;
  code: string;
  full: Blob;
  preview: Blob;
  blurData: string;
  width: number;
  height: number;
  /** Reservation on the server. Kept across retries so one photo never costs two shots. */
  photoId?: string;
  attempts: number;
  createdAt: number;
}

/** Enough of a queued photograph to draw it before it exists anywhere else. */
export interface PendingShot {
  localId: string;
  /** The ~32px inlined JPEG the camera made. The whole of what a tile needs. */
  blurData: string;
}

export interface QueueStatus {
  /** Which roll these counts are about. One queue, and a phone can hold two parties. */
  code: string | null;
  /** The frames still to go out, newest last — drawn on the wall until they are on it. */
  pending: PendingShot[];
  /**
   * Of those, the ones the server has not reserved a shot for yet.
   *
   * A quota is counted from `Photo` rows, so a frame that is captured but still sitting in
   * IndexedDB is one the roll screens cannot see — which is how a spent camera went on
   * offering a shot that no longer existed. Reserved items are excluded because the row is
   * already in the server's count, and subtracting them again would spend the shot twice.
   */
  unreserved: number;
  uploading: boolean;
  /**
   * Photographs this roll's queue has given up on, and destroyed the only copy of.
   *
   * It replaces a `lastError` string that was published on every failure and rendered
   * nowhere at all — so the one outcome worth interrupting somebody for, a frame that will
   * never arrive, was the one thing the app kept entirely to itself. Transient failures are
   * not counted here: those are still queued, and the line already says so.
   */
  dropped: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(database) {
      const store = database.createObjectStore(STORE, { keyPath: "localId" });
      store.createIndex("code", "code");
    },
  });
  return dbPromise;
}

/* ------------------------------------------------------------------ subscriptions */

const listeners = new Set<(status: QueueStatus) => void>();
let status: QueueStatus = {
  code: null,
  pending: [],
  unreserved: 0,
  uploading: false,
  dropped: 0,
};

function publish(patch: Partial<QueueStatus>) {
  status = { ...status, ...patch };
  for (const listener of listeners) listener(status);
}

export function subscribeQueue(listener: (status: QueueStatus) => void): () => void {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

async function refreshPending(code: string) {
  const items = (await (await db()).getAllFromIndex(STORE, "code", code)) as QueuedPhoto[];
  publish({
    code,
    pending: items.map(({ localId, blurData }) => ({ localId, blurData })),
    unreserved: items.filter((item) => !item.photoId).length,
    // A different roll's losses are not this one's. Reset on the way in rather than left to
    // accumulate across every roll a phone has ever held.
    ...(code === status.code ? {} : { dropped: 0 }),
  });
}

/**
 * The film this device has spent that the server cannot see, as a high-water mark.
 *
 * `previous` is the mark so far, `unreserved` what the queue is holding without a reservation
 * behind it, and `spent` how many frames this session has shot. The subtraction is the whole
 * point: a frame taken in this session sits in both counters, and adding them would take two
 * shots off the dial for one press. The maximum is the other half — a reservation landing
 * mid-session empties the queue without the page's `initialShots` being recounted, and
 * without this the camera would hand those shots straight back.
 */
export function carriedForward(previous: number, unreserved: number, spent: number): number {
  return Math.max(previous, unreserved - spent);
}

/* ------------------------------------------------------------------ queue ops */

export async function enqueuePhoto(code: string, photo: ProcessedPhoto): Promise<void> {
  const item: QueuedPhoto = {
    localId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    code,
    full: photo.full,
    preview: photo.preview,
    blurData: photo.blurData,
    width: photo.width,
    height: photo.height,
    attempts: 0,
    createdAt: Date.now(),
  };

  await (await db()).put(STORE, item);
  await refreshPending(code);
  void drainQueue(code);
}

async function putObject(url: string, blob: Blob): Promise<void> {
  const response = await fetch(url, {
    method: "PUT",
    body: blob,
    headers: { "content-type": "image/jpeg" },
  });
  if (!response.ok) throw new Error(`Upload failed (${response.status})`);
}

/**
 * Hands a reservation back before dropping the photograph it was for.
 *
 * A reserved shot is spent from the moment the row is written, so giving up on a photograph
 * without this left the guest a shot short with nothing to show for it — the counter said
 * three left, two frames were gone, and no screen anywhere could explain the difference.
 *
 * Best effort by design. The route refuses a photo that has already been confirmed, and a
 * session that is gone cannot call it at all; in both cases dropping the local copy is still
 * the right next move.
 */
async function releaseShot(code: string, photoId: string): Promise<void> {
  // `dropped`, so the route can tell this apart from a guest deleting a frame they simply did
  // not like. Only one of the two is a failure, and only one of them is worth counting.
  await fetch(`/api/r/${code}/photos/${photoId}?reason=dropped`, { method: "DELETE" }).catch(
    () => {},
  );
}

/** Errors that mean this photo will never succeed, so it should leave the queue. */
const TERMINAL = new Set(["no_shots_left", "not_shooting", "not_joined", "not_found"]);

let draining = false;

export async function drainQueue(code: string): Promise<void> {
  if (draining || typeof navigator !== "undefined" && !navigator.onLine) return;
  draining = true;
  publish({ uploading: true });

  try {
    const database = await db();

    for (;;) {
      const items = (await database.getAllFromIndex(STORE, "code", code)) as QueuedPhoto[];
      const item = items.sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!item) break;

      try {
        let photoId = item.photoId;
        let fullUrl: string;
        let previewUrl: string;

        if (!photoId) {
          const response = await fetch(`/api/r/${code}/photos`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            // Declared up front: the URL that comes back is signed for exactly these two
            // lengths, so R2 refuses anything else rather than storing it.
            body: JSON.stringify({
              contentType: "image/jpeg",
              fullBytes: item.full.size,
              previewBytes: item.preview.size,
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw Object.assign(new Error(data.error ?? "init_failed"), data);

          photoId = data.photoId as string;
          fullUrl = data.fullUrl;
          previewUrl = data.previewUrl;
          // Persist the reservation before uploading a single byte.
          await database.put(STORE, { ...item, photoId });
        } else {
          const response = await fetch(`/api/r/${code}/photos/${photoId}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              fullBytes: item.full.size,
              previewBytes: item.preview.size,
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw Object.assign(new Error(data.error ?? "resign_failed"), data);

          if (data.alreadyConfirmed) {
            await database.delete(STORE, item.localId);
            continue;
          }
          fullUrl = data.fullUrl;
          previewUrl = data.previewUrl;
        }

        await Promise.all([putObject(fullUrl, item.full), putObject(previewUrl, item.preview)]);

        const confirm = await fetch(`/api/r/${code}/photos/${photoId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            width: item.width,
            height: item.height,
            bytes: item.full.size,
            blurData: item.blurData,
            // The shutter's own moment, not the upload's. Without it a photo taken at the
            // party and sent from the taxi home is filed under the taxi.
            takenAt: new Date(item.createdAt).toISOString(),
          }),
        });
        if (!confirm.ok) throw new Error("confirm_failed");

        await database.delete(STORE, item.localId);
      } catch (error) {
        const reason = (error as { error?: string; message?: string }).error ?? "";

        if (TERMINAL.has(reason)) {
          // The reservation outlives the local copy unless it is given back here, and a shot
          // held by a photograph that will never arrive is a shot the guest simply loses.
          if (item.photoId) await releaseShot(code, item.photoId);
          await database.delete(STORE, item.localId);
          publish({ dropped: status.dropped + 1 });
          continue;
        }

        // Transient: leave it queued and stop for now. The next app open, the `online`
        // event, or the next capture will pick it back up.
        await database.put(STORE, { ...item, attempts: item.attempts + 1 });
        break;
      } finally {
        await refreshPending(code);
      }
    }
  } finally {
    draining = false;
    publish({ uploading: false });
    await refreshPending(code);
  }
}

/** Retry hooks: coming back online, and the tab becoming visible again. */
export function watchConnectivity(code: string): () => void {
  const retry = () => void drainQueue(code);
  const onVisible = () => {
    if (document.visibilityState === "visible") retry();
  };

  window.addEventListener("online", retry);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.removeEventListener("online", retry);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
