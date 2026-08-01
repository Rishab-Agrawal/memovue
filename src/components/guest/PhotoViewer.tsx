"use client";

import { useEffect, useRef } from "react";

export interface ViewerPhoto {
  id: string;
  previewUrl: string;
  blurData: string;
  guestName: string;
  takenAt: string;
}

/**
 * Full-screen viewer built on CSS scroll snapping rather than a gesture library: it gets
 * native-feeling momentum, keyboard and screen-reader support for free, and it degrades to
 * an ordinary scrolling list if anything goes wrong.
 */
export function PhotoViewer({
  code,
  photos,
  startIndex,
  onClose,
  onReachEnd,
}: {
  code: string;
  photos: ViewerPhoto[];
  startIndex: number;
  onClose: () => void;
  onReachEnd?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Jump to the tapped photo before the first paint so it never flashes photo #1.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = startIndex * container.clientHeight;
  }, [startIndex]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-ink">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-[calc(var(--safe-top)+1rem)] right-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-ink/60 text-paper backdrop-blur-md"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div
        ref={scrollRef}
        className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
        onScroll={(event) => {
          const el = event.currentTarget;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < el.clientHeight * 1.5) {
            onReachEnd?.();
          }
        }}
      >
        {photos.map((photo) => (
          <figure
            key={photo.id}
            className="relative flex h-full snap-start snap-always flex-col items-center justify-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL, not optimisable by next/image */}
            <img
              src={photo.previewUrl}
              alt={`Taken by ${photo.guestName}`}
              loading="lazy"
              className="max-h-full w-full object-contain"
            />
            <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-ink via-ink/75 to-transparent px-5 pt-16 pb-[calc(var(--safe-bottom)+1.25rem)]">
              <span>
                <span className="block text-[16px] text-paper">{photo.guestName}</span>
                <span className="block text-[13px] text-paper-faint">
                  {new Date(photo.takenAt).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </span>
              <a
                href={`/api/e/${code}/photos/${photo.id}/full?download=1`}
                className="shrink-0 rounded-full bg-paper/12 px-4 py-2 text-[14px] text-paper backdrop-blur-md"
              >
                Save
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
