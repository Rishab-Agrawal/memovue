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
  counted: null,
  uploading: false,
  dropped: 0,
};

/** One identity for "nothing", so an empty queue does not re-run every effect below. */
const NONE: PendingShot[] = [];

/**
 * What this phone still owes the wall in front of it: the photos just taken, drawn from
 * IndexedDB until the server's wall has them. Also restarts a stalled queue.
 */
export function useUploadQueue(
  /** Absent on a wall nobody's camera belongs to — the sample album has no queue. */
  code: string | undefined,
  /** The wall as it stands. Only its identity is read: a new one means it has been refetched. */
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
    A tile outlives its queue entry until the wall is refetched, so a confirmed photo does not
    vanish for the length of that fetch.
  */
  const [shots, setShots] = useState<PendingShot[]>(NONE);
  const drawn = useRef(wall);

  useEffect(() => {
    const arrived = drawn.current !== wall;
    drawn.current = wall;
    if (queued.length > 0 || arrived) setShots(queued);
  }, [queued, wall]);

  // The last one landed: ask for the wall again, once per settle so the refetch cannot loop.
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

/** A photograph that exists on this phone and nowhere else yet, at the head of the wall. */
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

/** Photos the queue gave up on for good — the one permanent outcome, so it is said out loud. */
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
