"use client";

import { useCallback, useEffect, useRef } from "react";

import { projectMomentum, spring, velocityFrom } from "@/lib/spring";

export interface ViewerPhoto {
  id: string;
  previewUrl: string;
  blurData: string;
  guestName: string;
  takenAt: string;
}

/** Where the tapped thumbnail was, so the viewer can grow out of it rather than cut to it. */
export interface OpenOrigin {
  x: number;
  y: number;
}

/** Past this much of the screen — after momentum is taken into account — it's leaving. */
const DISMISS_FRACTION = 0.3;
/** A flick this fast dismisses regardless of how far it actually travelled. */
const DISMISS_VELOCITY = 700;
/** Movement below this is a tap that wobbled, not a drag. */
const HYSTERESIS = 10;

/**
 * Full-screen viewer built on CSS scroll snapping rather than a gesture library: it gets
 * native-feeling momentum, keyboard and screen-reader support for free, and degrades to an
 * ordinary scrolling list if anything goes wrong.
 *
 * Three things sit on top of that.
 *
 * **It can be thrown away.** Pulling down from the first frame peels the viewer off the
 * album, tracking the finger exactly, and releases into a spring that continues at whatever
 * speed the finger was moving. Where it lands is decided by projecting the flick forward,
 * not by where the finger happened to stop — so a short fast flick dismisses and a long slow
 * drag falls back, which is what the gesture meant either time.
 *
 * **Back closes it.** It used to be a React state flag with no history entry, so the
 * hardware back button on Android left the album entirely — one stray press mid-reveal and a
 * guest was ejected from the thing they came for. The entry is pushed by the caller when it
 * opens this; here we only listen for it being popped.
 *
 * **It grows from the photo you tapped.** A cut from a grid cell to a full screen loses the
 * one piece of information the user needs to stay oriented: which of those forty squares am
 * I now looking at.
 */
export function PhotoViewer({
  code,
  photos,
  startIndex,
  origin,
  onClose,
  onReachEnd,
}: {
  code: string;
  photos: ViewerPhoto[];
  startIndex: number;
  origin?: OpenOrigin;
  onClose: () => void;
  onReachEnd?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);

  // Kept in a ref so the gesture and history listeners never need re-binding when the
  // parent re-renders mid-drag — rebinding a touch listener between two moves of the same
  // gesture is how a drag ends up half-tracked.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  const paint = useCallback((offset: number) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const height = window.innerHeight || 1;
    const progress = Math.min(1, Math.max(0, offset / height));

    // The photo shrinks slightly as it's pulled away and the black behind it thins out, so
    // the album underneath is already visible before the gesture commits.
    sheet.style.transform = `translate3d(0, ${offset}px, 0) scale(${1 - progress * 0.12})`;
    sheet.style.opacity = String(1 - progress * 0.55);
    if (chromeRef.current) chromeRef.current.style.opacity = String(1 - progress * 3);
  }, []);

  /* -------------------------------------------------------------------- entry */

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Anchored to the thumbnail's centre, so the screen expands out of the square that was
    // tapped instead of arriving from nowhere.
    if (origin) sheet.style.transformOrigin = `${origin.x}px ${origin.y}px`;

    const animation = sheet.animate(
      [
        { transform: "scale(0.86)", opacity: 0 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" },
    );

    return () => animation.cancel();
  }, [origin]);

  // Jump to the tapped photo before the first paint so it never flashes photo #1.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = startIndex * container.clientHeight;
  }, [startIndex]);

  /* -------------------------------------------------------------------- exits */

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /*
    Note that this only *listens*. The history entry itself is pushed by whoever opened the
    viewer, because pushing and popping from a mount effect is not safe: React invokes
    effects twice in development, so a cleanup that called `history.back()` fired a real
    popstate a moment after the second mount, and the viewer closed itself the instant it was
    opened. An effect that only subscribes and unsubscribes is idempotent; one that navigates
    is not.
  */
  useEffect(() => {
    function onPop() {
      closeRef.current();
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /* -------------------------------------------------------------------- gesture */

  useEffect(() => {
    const scroller = scrollRef.current;
    const sheet = sheetRef.current;
    if (!scroller || !sheet) return;

    let samples: { y: number; t: number }[] = [];
    let startY = 0;
    let offset = 0;
    let armed = false; // at the top when the finger landed, so a pull-down is a dismiss
    let dragging = false; // past the hysteresis threshold, now tracking
    let flight: ReturnType<typeof spring> | null = null;

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1) return;

      // An animation in flight is grabbable. Read where it is on screen right now rather
      // than where it was headed, or the photo jumps to meet the finger.
      if (flight) {
        offset = flight.value();
        flight.stop();
        flight = null;
        dragging = true;
        armed = true;
      } else {
        offset = 0;
        dragging = false;
        armed = scroller!.scrollTop <= 0;
      }

      startY = event.touches[0].clientY - offset;
      samples = [{ y: event.touches[0].clientY, t: event.timeStamp }];
    }

    function onTouchMove(event: TouchEvent) {
      if (!armed || event.touches.length !== 1) return;

      const y = event.touches[0].clientY;
      const next = y - startY;

      samples.push({ y, t: event.timeStamp });
      if (samples.length > 5) samples.shift();

      if (!dragging) {
        // Upward means they want the next photo — hand the gesture back to the scroller and
        // stay out of its way for the rest of this touch.
        if (next < -HYSTERESIS) {
          armed = false;
          return;
        }
        if (next < HYSTERESIS) return;
        dragging = true;
      }

      // Only now, once this is definitely a dismiss, is it safe to take the touch away from
      // the scroller. Claiming it earlier would make every upward swipe feel snagged.
      if (event.cancelable) event.preventDefault();
      offset = Math.max(0, next);
      paint(offset);
    }

    function onTouchEnd(event: TouchEvent) {
      if (!dragging) {
        armed = false;
        return;
      }
      dragging = false;
      armed = false;

      const height = window.innerHeight || 1;
      const velocity = velocityFrom(samples);
      const projected = offset + projectMomentum(velocity);
      const leaving = projected > height * DISMISS_FRACTION || velocity > DISMISS_VELOCITY;

      if (event.cancelable) event.preventDefault();

      flight = spring({
        from: offset,
        to: leaving ? height : 0,
        velocity,
        // Leaving is quicker than returning: an exit the user asked for shouldn't be
        // something they wait through, but a spring back should read as the screen
        // settling rather than snapping.
        response: leaving ? 0.32 : 0.42,
        onFrame: paint,
        onRest: () => {
          flight = null;
          if (leaving) closeRef.current();
        },
      });
    }

    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: false });
    scroller.addEventListener("touchend", onTouchEnd);
    scroller.addEventListener("touchcancel", onTouchEnd);

    return () => {
      flight?.stop();
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [paint]);

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
      className="fixed inset-0 z-50 bg-void will-change-transform"
    >
      <div ref={chromeRef} className="pointer-events-none absolute inset-x-0 top-0 z-10">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="pointer-events-auto absolute top-[calc(var(--safe-top)+0.75rem)] right-3 grid h-11 w-11 place-items-center border border-chalk/25 bg-void/50 text-chalk backdrop-blur-md transition-colors active:bg-void/80"
        >
          <CloseIcon />
        </button>
      </div>

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
              draggable={false}
              className="max-h-full w-full object-contain"
            />
            <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-void via-void/80 to-transparent px-5 pt-20 pb-[calc(var(--safe-bottom)+1.25rem)]">
              <span className="min-w-0">
                <span className="block truncate text-[16px] text-chalk">{photo.guestName}</span>
                <span className="marking mt-1 block">
                  {new Date(photo.takenAt).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </span>
              <a
                href={`/api/e/${code}/photos/${photo.id}/full?download=1`}
                className="marking inline-flex h-11 shrink-0 items-center gap-2 border border-chalk/25 px-4 text-chalk backdrop-blur-md transition-colors hover:border-flame hover:text-flame active:bg-chalk/10"
              >
                <SaveIcon />
                Save
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5v11m0 0 4-4m-4 4-4-4" />
      <path d="M4.5 16.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
