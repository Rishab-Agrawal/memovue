"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import type { ProcessedPhoto } from "@/lib/image";
import {
  type QueueStatus,
  drainQueue,
  enqueuePhoto,
  subscribeQueue,
  watchConnectivity,
} from "@/lib/upload-queue";

import { AlbumView } from "./AlbumView";
import { CameraView } from "./CameraView";

interface GuestAppProps {
  code: string;
  rollName: string;
  capturing: boolean;
  shotsLeft: number;
  /**
   * Where leaving the camera lands: the host's own roll screen, or the rolls list for a guest
   * with an account. Null for an anonymous guest, who arrived by QR and has nowhere of their
   * own to go — they get no back button rather than a dead one.
   */
  home: string | null;
}

/** Long enough to read as the album sliding away, short enough not to be a wait. */
const SHEET_OUT_MS = 260;

export function GuestApp({
  code,
  rollName,
  capturing,
  shotsLeft: initialShots,
  home,
}: GuestAppProps) {
  const router = useRouter();

  /**
   * The album is a sheet over the camera, not a second page.
   *
   * Swapping one React tree for the other unmounts the viewfinder, which tears down the
   * `MediaStream` — so every glance at the album cost a second of black and "waking the
   * camera" on the way back, during an event where people flick between the two constantly.
   * The camera stays live underneath and the album rises over it, leaving along the axis it
   * arrived on. That is also what a phone's own camera app does.
   */
  const [sheet, setSheet] = useState<"closed" | "open" | "closing">(
    capturing ? "closed" : "open",
  );
  const [shotsLeft, setShotsLeft] = useState(initialShots);
  const [queue, setQueue] = useState<QueueStatus>({
    pending: 0,
    uploading: false,
    lastError: null,
  });

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Anything left in the queue from a previous session goes out as soon as we're back.
  useEffect(() => {
    void drainQueue(code);
    const unwatch = watchConnectivity(code);
    const unsubscribe = subscribeQueue(setQueue);
    return () => {
      unwatch();
      unsubscribe();
    };
  }, [code]);

  useEffect(() => () => void (closeTimer.current && clearTimeout(closeTimer.current)), []);

  /*
    Back belongs to the sheet while the sheet is up. Without this, a guest who opened the
    album and pressed back left the roll altogether.

    The entry is pushed and spent in these handlers rather than in an effect: effects run
    twice in development and have to be safe to repeat, and `pushState`/`back()` are not.
  */
  function openSheet() {
    window.history.pushState({ mvAlbum: true }, "");
    setSheet("open");
  }

  const closeSheet = useCallback(() => {
    setSheet((current) => {
      if (current !== "open") return current;
      closeTimer.current = setTimeout(() => setSheet("closed"), SHEET_OUT_MS);
      return "closing";
    });
    // Falsy when we got here *from* a back press — the entry is already gone, and popping
    // again would take the guest off the roll.
    if (window.history.state?.mvAlbum) window.history.back();
  }, []);

  useEffect(() => {
    if (sheet !== "open") return;

    function onPop() {
      // The photo viewer stacks its own entry on top of ours. If ours is still current,
      // what just got popped was the viewer — one back press should close one layer.
      if (window.history.state?.mvAlbum) return;
      closeSheet();
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [sheet, closeSheet]);

  /**
   * No keep/retake step. The shot is spent the moment the shutter fires, the frame flies
   * into the thumbnail, and the upload happens in the background — surviving a locked phone
   * or a dead signal because it goes through the queue rather than straight to the network.
   */
  async function handleCaptured(photo: ProcessedPhoto) {
    const left = Math.max(0, shotsLeft - 1);
    setShotsLeft(left);
    await enqueuePhoto(code, photo);

    /*
      Out of film. Sitting on a dead viewfinder with a greyed-out shutter is the camera
      pretending it still has a job, so it closes: back to the roll for anyone who has one,
      and up into the album for a guest who does not.

      The upload is unaffected — the queue is a module, not a component, so it keeps draining
      across a client-side navigation.
    */
    if (left === 0) {
      if (home) router.push(home);
      else openSheet();
    }
  }

  /*
    The queue outlives the shutter, so its status has to be visible on this screen too.

    Photographs taken in the last minutes of an event are usually still in IndexedDB when it
    closes, and they upload from here. Without this line the album says "Nothing shot yet" over
    a phone that is at that moment sending ten of them, which reads exactly like the photos
    were lost.
  */
  if (!capturing) {
    return (
      <div className="min-h-dvh bg-page">
        <div className="pt-[var(--safe-top)]">
          {queue.pending > 0 ? <QueueStatusLine queue={queue} /> : null}
          <AlbumView code={code} onRevealed={() => router.refresh()} />
        </div>
      </div>
    );
  }

  const sheetOpen = sheet !== "closed";

  return (
    <div className="fixed inset-0 bg-page">
      <div className="h-full pt-[var(--safe-top)]">
        <CameraView
          shotsLeft={shotsLeft}
          disabled={sheetOpen}
          inert={sheetOpen}
          onCaptured={handleCaptured}
          onOpenAlbum={openSheet}
        />
      </div>

      {home ? (
        <Link
          href={home}
          aria-label="Leave the camera"
          className="absolute top-[calc(var(--safe-top)+0.25rem)] left-4 z-10 flex h-11 w-11 items-center justify-center rounded-2xl bg-void/50 text-[20px] text-chalk backdrop-blur-sm transition-colors hover:text-flame"
        >
          ←
        </Link>
      ) : null}

      <span className="marking pointer-events-none absolute inset-x-0 top-[calc(var(--safe-top)+0.5rem)] truncate px-16 text-center text-chalk/60">
        {rollName}
      </span>

      {queue.pending > 0 && !sheetOpen ? (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--safe-top)+2.25rem)]">
          <QueueStatusLine queue={queue} />
        </div>
      ) : null}

      {sheetOpen ? (
        <div
          className={cn(
            "absolute inset-0 z-20 overflow-y-auto overscroll-contain bg-page",
            sheet === "open" ? "animate-sheet-in" : "animate-sheet-out",
          )}
        >
          <div className="pt-[var(--safe-top)]">
            <AlbumView code={code} onRevealed={() => router.refresh()} />
          </div>

          <button
            type="button"
            onClick={closeSheet}
            className="fixed right-5 bottom-[calc(var(--safe-bottom)+1.25rem)] z-30 flex h-13 items-center gap-3 rounded-full bg-flame px-6 text-[14px] font-medium text-void shadow-[0_0_32px_-6px_rgba(255,140,0,0.7)] transition-transform duration-200 active:scale-[0.97]"
          >
            {shotsLeft > 0 ? <span className="tabular">{shotsLeft} left</span> : "Out of film"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** One line, two screens: over the viewfinder while shooting, above the album once closed. */
function QueueStatusLine({ queue }: { queue: QueueStatus }) {
  const n = queue.pending;
  return (
    <p role="status" className="marking text-center">
      {queue.uploading ? `Saving ${n} photo${n === 1 ? "" : "s"}` : `${n} waiting for signal`}
    </p>
  );
}
