"use client";

import { useEffect, useRef, useState } from "react";

import {
  type PendingShot,
  type QueueStatus,
  drainQueue,
  subscribeQueue,
  watchConnectivity,
} from "@/lib/upload-queue";

const IDLE: QueueStatus = {
  code: null,
  pending: [],
  unreserved: 0,
  uploading: false,
  dropped: 0,
};

/** One identity for "nothing", so an empty queue does not re-run every effect below. */
const NONE: PendingShot[] = [];

/**
 * What this phone still owes the wall in front of it.
 *
 * The camera says nothing about uploading — where the bytes are is our problem, not the
 * guest's. What was wrong was the other end: they walked out of the viewfinder onto a wall
 * that did not have their photograph, because the upload was still going and the wall is the
 * server's. A line of text saying so was the first answer and the wrong one; the picture they
 * just took is the answer, drawn from the copy in IndexedDB until the real one arrives.
 *
 * Draining lives here too, so a screen that shows the wall is also what restarts a stalled
 * queue.
 */
export function useUploadQueue(
  /** Absent on a wall nobody's camera belongs to — the sample album has no queue. */
  code: string | undefined,
  /**
   * The wall as it currently stands. Only its identity is read: a new one means the wall has
   * been fetched since, which is what retires the tiles below.
   */
  wall: unknown,
  /** How the wall refetches itself once the last frame has landed. Must be stable. */
  onSettled: () => void,
): { shots: PendingShot[]; waiting: boolean; dropped: number } {
  const [queue, setQueue] = useState<QueueStatus>(IDLE);

  useEffect(() => {
    if (!code) return;
    void drainQueue(code);
    const unwatch = watchConnectivity(code);
    const unsubscribe = subscribeQueue(setQueue);
    return () => {
      unwatch();
      unsubscribe();
    };
  }, [code]);

  // One queue, and a phone can hold two parties.
  const queued = code && queue.code === code ? queue.pending : NONE;

  /*
    What to draw, which is not simply what is queued.

    A photograph leaves the queue the instant the server confirms it — and the wall it is now
    on has not been fetched yet. Dropping the tile at that moment takes the picture off the
    screen for the length of that fetch, and on a wall with nothing else on it puts "Nothing
    shot yet" in its place, which is the one sentence this whole feature exists to prevent.

    So the tile outlives the queue entry and it is the wall that retires it: whatever is still
    queued when a fetch lands is still owed, and whatever is not is on the wall now.
  */
  const [shots, setShots] = useState<PendingShot[]>(NONE);
  const drawn = useRef(wall);

  useEffect(() => {
    const arrived = drawn.current !== wall;
    drawn.current = wall;
    if (queued.length > 0 || arrived) setShots(queued);
  }, [queued, wall]);

  /*
    The last one landed, so the wall is asked for again — it was rendered before these
    photographs existed anywhere we could see.

    Once per settle. The refetch re-renders whatever is holding this hook, and an ask that
    re-armed on its own answer would be a screen refreshing itself as fast as the server can
    reply.
  */
  const asked = useRef(false);
  useEffect(() => {
    if (queued.length > 0) {
      asked.current = false;
      return;
    }
    if (shots.length === 0 || asked.current) return;
    asked.current = true;
    onSettled();
  }, [queued, shots.length, onSettled]);

  return {
    shots,
    // Stalled rather than working: there is film waiting and nothing is moving it.
    waiting: queued.length > 0 && !queue.uploading,
    dropped: code && queue.code === code ? queue.dropped : 0,
  };
}

/**
 * A photograph that exists on this phone and nowhere else yet.
 *
 * The same blurred square the roll shows before the reveal, because that is what it is — the
 * ~32px placeholder the camera made on the way past. It sits at the head of the wall, where
 * the real one will be.
 */
export function GhostTile({ shot, waiting }: { shot: PendingShot; waiting: boolean }) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-void">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={shot.blurData}
        alt=""
        className="h-full w-full object-cover"
        style={{ filter: "blur(14px) saturate(0.6)" }}
      />
      <span
        role="status"
        className="marking animate-wait absolute bottom-3 left-3 text-chalk/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
      >
        {waiting ? "Waiting for signal" : "Saving…"}
      </span>
    </div>
  );
}

/**
 * A photograph we could not save, said out loud.
 *
 * The one queue outcome that is permanent: the roll refused the frame, so the local copy went
 * with it. It used to be recorded in a `lastError` field that no screen anywhere read — the
 * app quietly destroying somebody's photograph and telling only itself.
 */
export function LostShots({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <p role="status" className="text-center text-[13px] leading-snug text-danger">
      {count === 1
        ? "One photo couldn’t be saved to this roll."
        : `${count} photos couldn’t be saved to this roll.`}
    </p>
  );
}
