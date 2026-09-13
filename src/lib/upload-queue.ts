import { type IDBPDatabase, openDB } from "idb";

import type { ProcessedPhoto } from "./image";

/**
 * Durable upload queue. A photo is written to IndexedDB before any network call, and retried on
 * the next app open or when the device comes back online — venue wifi is bad and phones lock.
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
  blurData: string;
}

export interface QueueStatus {
  /** Which roll these counts are about. One queue, and a phone can hold two parties. */
  code: string | null;
  /** Frames still to go out, newest last. */
  pending: PendingShot[];
  /**
   * Of those, the ones without a server reservation — spent film the server cannot count yet.
   * Reserved items are excluded because their row is already in the server's count.
   */
  unreserved: number;
  uploading: boolean;
  /** Photographs this roll's queue has given up on for good. Transient failures stay queued. */
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

/**
 * One IndexedDB call, reopening the connection once if the browser closed it — iOS does that to
 * backgrounded pages, and says so only by failing the next call. Every call here is a single
 * get, put or delete, so repeating it is harmless.
 */
async function withDb<T>(run: (database: IDBPDatabase) => Promise<T>): Promise<T> {
  try {
    return await run(await db());
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "InvalidStateError")) throw error;
    dbPromise = null;
    return run(await db());
  }
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
  const items = (await withDb((d) => d.getAllFromIndex(STORE, "code", code))) as QueuedPhoto[];
  publish({
    code,
    pending: items.map(({ localId, blurData }) => ({ localId, blurData })),
    unreserved: items.filter((item) => !item.photoId).length,
    // A different roll's losses are not this one's.
    ...(code === status.code ? {} : { dropped: 0 }),
  });
}

/**
 * Film this device has spent that the server cannot see, as a high-water mark.
 *
 * A frame shot this session sits in both `unreserved` and `spent`, so they are subtracted, not
 * added. The maximum keeps shots from coming back when a reservation lands mid-session and
 * empties the queue before `initialShots` is recounted.
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

  await withDb((d) => d.put(STORE, item));
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
 * Hands a reservation back before dropping its photograph, so the guest does not lose a shot
 * to a frame that will never arrive. Best effort: dropping the local copy is right either way.
 */
async function releaseShot(code: string, photoId: string): Promise<void> {
  // `dropped` tells the route this is a failure, not a guest deleting a frame they disliked.
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
    for (;;) {
      const items = (await withDb((d) => d.getAllFromIndex(STORE, "code", code))) as QueuedPhoto[];
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
            // The URLs that come back are signed for exactly these lengths.
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
          await withDb((d) => d.put(STORE, { ...item, photoId }));
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
            await withDb((d) => d.delete(STORE, item.localId));
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
            // The shutter's moment, not the upload's.
            takenAt: new Date(item.createdAt).toISOString(),
          }),
        });
        if (!confirm.ok) throw new Error("confirm_failed");

        await withDb((d) => d.delete(STORE, item.localId));
      } catch (error) {
        const reason = (error as { error?: string; message?: string }).error ?? "";

        if (TERMINAL.has(reason)) {
          if (item.photoId) await releaseShot(code, item.photoId);
          await withDb((d) => d.delete(STORE, item.localId));
          publish({ dropped: status.dropped + 1 });
          continue;
        }

        // Transient: leave it queued. The next app open, `online` event or capture retries.
        await withDb((d) => d.put(STORE, { ...item, attempts: item.attempts + 1 }));
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
