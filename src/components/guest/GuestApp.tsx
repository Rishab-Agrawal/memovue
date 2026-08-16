"use client";

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
import { ReviewOverlay } from "./ReviewOverlay";

interface GuestAppProps {
  code: string;
  eventName: string;
  phase: "scheduled" | "capturing" | "revealed";
  shotsLeft: number;
}

/** Long enough to read as the album sliding away, short enough not to be a wait. */
const SHEET_OUT_MS = 260;

export function GuestApp({ code, eventName, phase, shotsLeft: initialShots }: GuestAppProps) {
  const router = useRouter();
  const canShoot = phase === "capturing";

  /**
   * The album is a sheet over the camera, not a second page.
   *
   * It used to be a state flag that swapped one React tree for the other: an instant cut in
   * both directions, with no sense of where the album had come from or where the camera had
   * gone. Worse, unmounting the viewfinder tore down the `MediaStream`, so every glance at
   * the album cost a second or two of black and "Waking the camera" on the way back — during
   * an event where people flick between the two constantly.
   *
   * Now the camera stays live underneath and the album rises over it, leaving along the same
   * axis it arrived on. This is also what the phone's own camera app does when you swipe
   * across to the roll, so the camera indicator staying lit is the behaviour people expect
   * rather than a surprise.
   */
  const [sheet, setSheet] = useState<"closed" | "open" | "closing">(canShoot ? "closed" : "open");
  const [review, setReview] = useState<{ photo: ProcessedPhoto; url: string } | null>(null);
  const [shotsLeft, setShotsLeft] = useState(initialShots);
  const [queue, setQueue] = useState<QueueStatus>({
    pending: 0,
    uploading: false,
    lastError: null,
  });
  const [saving, setSaving] = useState(false);

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
    album and pressed back left the event altogether and landed on whatever page preceded it —
    the browser had no idea anything had opened.

    The entry is pushed and spent in these two handlers rather than in an effect. Effects run
    twice in development and have to be safe to repeat; `pushState` and `back()` are not, and
    doing it there made the sheet slam shut the moment it opened.
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
    // again would take the guest off the event.
    if (window.history.state?.mvAlbum) window.history.back();
  }, []);

  useEffect(() => {
    if (sheet !== "open") return;

    function onPop() {
      // The photo viewer stacks its own entry on top of ours. If ours is still the current
      // one, what just got popped was the viewer, not the album — one back press should
      // close one layer, and without this check it closed both.
      if (window.history.state?.mvAlbum) return;
      closeSheet();
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [sheet, closeSheet]);

  async function keepPhoto() {
    if (!review) return;
    setSaving(true);
    try {
      await enqueuePhoto(code, review.photo);
      setShotsLeft((n) => Math.max(0, n - 1));
      URL.revokeObjectURL(review.url);
      setReview(null);
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------------------------------------------ album only */

  // Before the start and after the reveal there is no camera to be a sheet over.
  if (!canShoot) {
    return (
      <div className="min-h-dvh bg-page">
        <div className="pt-[var(--safe-top)]">
          <AlbumView code={code} onRevealed={() => router.refresh()} />
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ camera */

  const sheetOpen = sheet !== "closed";

  return (
    <div className="fixed inset-0 bg-void">
      <CameraView
        shotsLeft={shotsLeft}
        disabled={Boolean(review) || sheetOpen}
        inert={sheetOpen}
        onCaptured={(photo, url) => setReview({ photo, url })}
      />

      {/* Chrome is deliberately sparse — a viewfinder, not a dashboard. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-4 px-5 pt-[calc(var(--safe-top)+1.25rem)] transition-opacity duration-200",
          sheetOpen && "opacity-0",
        )}
        aria-hidden={sheetOpen}
      >
        <span className="marking truncate text-chalk/70">{eventName}</span>
        <span
          data-testid="shots-left"
          className={cn(
            "tabular shrink-0 text-[14px]",
            shotsLeft === 0 ? "text-danger" : shotsLeft <= 3 ? "text-flame" : "text-chalk",
          )}
        >
          {shotsLeft} <span className="marking">left</span>
        </span>
      </div>

      {queue.pending > 0 && !sheetOpen ? (
        <p
          role="status"
          className="marking pointer-events-none absolute inset-x-0 top-[calc(var(--safe-top)+3.5rem)] text-center"
        >
          {queue.uploading
            ? `Saving ${queue.pending} photo${queue.pending === 1 ? "" : "s"}`
            : `${queue.pending} waiting for signal`}
        </p>
      ) : null}

      {/* Album button, bottom-left — where the camera roll lives on a phone. */}
      <button
        type="button"
        onClick={openSheet}
        aria-label="See the album"
        aria-expanded={sheetOpen}
        className={cn(
          "absolute bottom-[calc(var(--safe-bottom)+2.7rem)] left-8 grid h-11 w-11 place-items-center",
          "border border-chalk/25 bg-void/40 text-chalk backdrop-blur-md",
          "transition-[opacity,transform] duration-200 active:scale-95",
          sheetOpen && "pointer-events-none opacity-0",
        )}
      >
        <StackIcon />
      </button>

      {shotsLeft === 0 && !sheetOpen ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--safe-bottom)+9rem)] px-10 text-center">
          <p className="border-l-2 border-flame bg-void/70 py-3 pl-4 text-left text-[14px] leading-relaxed text-chalk backdrop-blur-md">
            That&rsquo;s all your shots. Everything unlocks for everyone at reveal time.
          </p>
        </div>
      ) : null}

      {/* ---------------------------------------------------------- album sheet */}
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
            className="fixed right-5 bottom-[calc(var(--safe-bottom)+1.25rem)] z-30 flex h-13 items-center gap-3 bg-flame px-6 text-[14px] font-medium text-void shadow-[0_0_32px_-6px_rgba(255,140,0,0.7)] transition-transform duration-200 active:scale-[0.97]"
          >
            <CameraIcon />
            {shotsLeft > 0 ? <span className="tabular">{shotsLeft} left</span> : "Out of film"}
          </button>
        </div>
      ) : null}

      {review ? (
        <ReviewOverlay
          imageUrl={review.url}
          busy={saving}
          shotsLeftAfter={Math.max(0, shotsLeft - 1)}
          onRetake={() => {
            URL.revokeObjectURL(review.url);
            setReview(null);
          }}
          onKeep={keepPhoto}
        />
      ) : null}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      aria-hidden="true"
    >
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.9l1.2-1.8A1 1 0 0 1 9.4 3.8h5.2a1 1 0 0 1 .8.4L16.6 6h1.9A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-8Z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="7" y="3.5" width="13.5" height="13.5" />
      <path d="M16.5 20.5H6A2.5 2.5 0 0 1 3.5 18V7.5" />
    </svg>
  );
}
