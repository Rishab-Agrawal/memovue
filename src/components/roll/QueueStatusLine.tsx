"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  type QueueStatus,
  drainQueue,
  subscribeQueue,
  watchConnectivity,
} from "@/lib/upload-queue";

/**
 * What this phone still owes the roll, said on the roll's own screen and nowhere else.
 *
 * The camera says nothing about uploading. Where the bytes are is our problem, not the
 * guest's — the shutter fires, the frame flies into the thumbnail, and that is the whole
 * story a viewfinder should tell. The one screen where it is worth a word is the wall the
 * photograph is missing from: someone who walks out of the camera into an album without
 * their last shot on it has been handed a reason to think it was lost.
 *
 * And when the last one lands, the screen behind this line is asked for again. It was
 * rendered before those photographs reached us, which is why finding your own picture used
 * to mean reloading the page by hand.
 *
 * Draining lives here too, so simply rendering the line is what restarts a stalled queue.
 */
export function QueueStatusLine({
  code,
  onSettled,
}: {
  code: string;
  /**
   * How the screen behind this refetches itself. A server-rendered wall needs no more than
   * a router refresh, which is the default; the guest album fetches its own grid.
   */
  onSettled?: () => void;
}) {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueStatus>({
    code: null,
    pending: 0,
    unreserved: 0,
    uploading: false,
    dropped: 0,
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

  // Only after this screen has actually been owed something, so arriving at a settled queue
  // does not refetch a wall that is already correct.
  const owed = useRef(false);
  useEffect(() => {
    if (owed.current && queue.pending === 0) {
      if (onSettled) onSettled();
      else router.refresh();
    }
    owed.current = queue.pending > 0;
  }, [queue.pending, onSettled, router]);

  /*
    A photograph we could not save, said out loud.

    This is the one queue outcome that is permanent: the roll refused the frame, so the local
    copy went with it. It used to be recorded in a `lastError` field that no screen anywhere
    read — the app quietly destroying somebody's photograph and telling only itself.
  */
  const lost = queue.code === code ? queue.dropped : 0;
  if (lost > 0) {
    return (
      <p role="status" className="text-center text-[13px] leading-snug text-danger">
        {lost === 1
          ? "One photo couldn’t be saved to this roll."
          : `${lost} photos couldn’t be saved to this roll.`}
      </p>
    );
  }

  if (queue.pending === 0) return null;

  const n = queue.pending;
  return (
    <p role="status" className="marking text-center text-dust">
      {queue.uploading ? `Saving ${n} photo${n === 1 ? "" : "s"}` : `${n} waiting for signal`}
    </p>
  );
}
