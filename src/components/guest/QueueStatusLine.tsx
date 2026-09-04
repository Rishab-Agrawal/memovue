"use client";

import { useEffect, useState } from "react";

import {
  type QueueStatus,
  drainQueue,
  subscribeQueue,
  watchConnectivity,
} from "@/lib/upload-queue";

/**
 * What the upload queue is doing, on whichever guest screen is showing.
 *
 * It has to be on both. Photographs taken in the last minutes of an event are usually still
 * in IndexedDB when the roll closes, and they go out from the album as readily as from the
 * camera — without this line the album says "Nothing shot yet" over a phone that is at that
 * moment sending ten of them, which reads exactly like the photos were lost.
 *
 * Draining lives here too, so simply rendering the line is what restarts a stalled queue.
 */
export function QueueStatusLine({ code }: { code: string }) {
  const [queue, setQueue] = useState<QueueStatus>({
    pending: 0,
    uploading: false,
    lastError: null,
  });

  useEffect(() => {
    void drainQueue(code);
    const unwatch = watchConnectivity(code);
    const unsubscribe = subscribeQueue(setQueue);
    return () => {
      unwatch();
      unsubscribe();
    };
  }, [code]);

  if (queue.pending === 0) return null;

  const n = queue.pending;
  return (
    <p role="status" className="marking text-center">
      {queue.uploading ? `Saving ${n} photo${n === 1 ? "" : "s"}` : `${n} waiting for signal`}
    </p>
  );
}
