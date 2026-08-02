"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

export function GuestApp({ code, eventName, phase, shotsLeft: initialShots }: GuestAppProps) {
  const router = useRouter();
  const canShoot = phase === "capturing";

  const [view, setView] = useState<"camera" | "album">(canShoot ? "camera" : "album");
  const [review, setReview] = useState<{ photo: ProcessedPhoto; url: string } | null>(null);
  const [shotsLeft, setShotsLeft] = useState(initialShots);
  const [queue, setQueue] = useState<QueueStatus>({
    pending: 0,
    uploading: false,
    lastError: null,
  });
  const [saving, setSaving] = useState(false);

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

  /* ------------------------------------------------------------------ album */

  if (view === "album" || !canShoot) {
    return (
      <div className="min-h-dvh bg-void">
        <div className="pt-[var(--safe-top)]">
          <AlbumView code={code} onRevealed={() => router.refresh()} />
        </div>

        {canShoot ? (
          <button
            type="button"
            onClick={() => setView("camera")}
            className="fixed right-5 bottom-[calc(var(--safe-bottom)+1.25rem)] z-30 flex h-13 items-center gap-3 bg-flame px-6 py-3.5 text-[14px] font-medium text-void shadow-[0_0_32px_-6px_rgba(255,140,0,0.7)]"
          >
            <CameraIcon />
            {shotsLeft > 0 ? (
              <span className="tabular">{shotsLeft} left</span>
            ) : (
              "Out of film"
            )}
          </button>
        ) : null}
      </div>
    );
  }

  /* ------------------------------------------------------------------ camera */

  return (
    <div className="fixed inset-0 bg-void">
      <CameraView
        shotsLeft={shotsLeft}
        disabled={Boolean(review)}
        onCaptured={(photo, url) => setReview({ photo, url })}
      />

      {/* Chrome is deliberately sparse — a viewfinder, not a dashboard. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-4 px-5 pt-[calc(var(--safe-top)+1.25rem)]">
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

      {queue.pending > 0 ? (
        <p className="marking pointer-events-none absolute inset-x-0 top-[calc(var(--safe-top)+3.5rem)] text-center">
          {queue.uploading
            ? `Saving ${queue.pending} photo${queue.pending === 1 ? "" : "s"}`
            : `${queue.pending} waiting for signal`}
        </p>
      ) : null}

      {/* Album button, bottom-left — where the camera roll lives on a phone. */}
      <button
        type="button"
        onClick={() => setView("album")}
        aria-label="See the album"
        className="absolute bottom-[calc(var(--safe-bottom)+2.7rem)] left-8 grid h-11 w-11 place-items-center border border-chalk/25 bg-void/40 text-chalk backdrop-blur-md"
      >
        <StackIcon />
      </button>

      {shotsLeft === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--safe-bottom)+9rem)] px-10 text-center">
          <p className="border-l-2 border-flame bg-void/70 py-3 pl-4 text-left text-[14px] leading-relaxed text-chalk backdrop-blur-md">
            That&rsquo;s all your shots. Everything unlocks for everyone at reveal time.
          </p>
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
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.9l1.2-1.8A1 1 0 0 1 9.4 3.8h5.2a1 1 0 0 1 .8.4L16.6 6h1.9A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-8Z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="7" y="3.5" width="13.5" height="13.5" />
      <path d="M16.5 20.5H6A2.5 2.5 0 0 1 3.5 18V7.5" />
    </svg>
  );
}
