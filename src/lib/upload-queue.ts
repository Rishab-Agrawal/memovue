import { type IDBPDatabase, openDB } from "idb";
import { useEffect, useSyncExternalStore } from "react";

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
  /** Film left as the server last answered, with `unreserved` read at the same moment. Null until asked. */
  counted: number | null;
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
  counted: null,
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

/** Frames taken whose IndexedDB write has not finished. Spent already, and not on disk yet. */
let writing = 0;

async function refreshPending(code: string, counted?: number) {
  const items = (await withDb((d) => d.getAllFromIndex(STORE, "code", code))) as QueuedPhoto[];
  const same = code === status.code;
  publish({
    code,
    pending: items.map(({ localId, blurData }) => ({ localId, blurData })),
    unreserved: items.filter((item) => !item.photoId).length + writing,
    counted: counted ?? (same ? status.counted : null),
    // A different roll's losses are not this one's.
    ...(same ? {} : { dropped: 0 }),
  });
}

/**
 * Film this phone has left on a roll: the server's last count less what it has not heard of.
 * `rendered` stands in until the queue has asked, and a new one sends it to ask again.
 */
export function useFilmLeft(code: string | undefined, rendered: number): number {
  const queue = useSyncExternalStore(subscribeQueue, () => status, () => status);
  useEffect(() => {
    if (code) void drainQueue(code);
  }, [code, rendered]);
  if (!code || queue.code !== code) return rendered;
  return Math.max(0, (queue.counted ?? rendered) - queue.unreserved);
}

/** Film drawn from or given to the pool, which moves the count without a reservation. */
export function addFilm(code: string, shots: number) {
  if (code === status.code && status.counted !== null) publish({ counted: status.counted + shots });
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

  // Spent the moment it is taken, not once IndexedDB has it.
  writing += 1;
  if (code === status.code) publish({ unreserved: status.unreserved + 1 });
  try {
    await withDb((d) => d.put(STORE, item));
  } finally {
    writing -= 1;
  }
  await refreshPending(code);
  void drain(code);
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

/**
 * Asks the server what this roll has left. Only ever inside the drain, so no reservation lands
 * between its answer and the queue it is paired with.
 */
async function recount(code: string): Promise<void> {
  // The queue's side first, so a frame taken meanwhile is counted against this roll.
  await refreshPending(code);
  const response = await fetch(`/api/r/${code}/feed`, { cache: "no-store" }).catch(() => null);
  if (!response?.ok) return;
  const feed = (await response.json()) as { me: { shotsLeft: number } };
  await refreshPending(code, feed.me.shotsLeft);
}

let draining = false;
/** Rolls whose count wants asking again, taken up by the next drain. */
const unsynced = new Set<string>();

/** Sends what is queued, asking the server for a fresh count first. */
export function drainQueue(code: string): Promise<void> {
  unsynced.add(code);
  return drain(code);
}

async function drain(code: string): Promise<void> {
  if (draining || typeof navigator !== "undefined" && !navigator.onLine) return;
  draining = true;
  publish({ uploading: true });

  try {
    for (;;) {
      if (unsynced.delete(code)) await recount(code);
      const items = (await withDb((d) => d.getAllFromIndex(STORE, "code", code))) as QueuedPhoto[];
      const item = items.sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!item) break;

      /** The count the server answers with, when it answers with one. */
      let answer: number | undefined;
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
              // Asked twice, by a lost answer or a second tab, this is still one reservation.
              clientId: item.localId,
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw Object.assign(new Error(data.error ?? "init_failed"), data);

          photoId = data.photoId as string;
          answer = data.shotsLeft;
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
          if (reason === "no_shots_left") answer = 0;
          if (item.photoId) await releaseShot(code, item.photoId);
          await withDb((d) => d.delete(STORE, item.localId));
          publish({ dropped: status.dropped + 1 });
          continue;
        }

        // Transient: leave it queued. The next app open, `online` event or capture retries.
        await withDb((d) => d.put(STORE, { ...item, attempts: item.attempts + 1 }));
        break;
      } finally {
        await refreshPending(code, answer);
      }
    }
  } finally {
    draining = false;
    publish({ uploading: false });
    await refreshPending(code);
    // Asked for while this one ran.
    const [next] = unsynced;
    if (next) void drain(next);
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
