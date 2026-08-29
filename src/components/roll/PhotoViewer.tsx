"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Pill } from "@/components/roll/Chrome";
import { Download } from "@/components/roll/Icons";
import { formatStamp } from "@/lib/format";
import { spring, swipeDelta, velocityFrom } from "@/lib/spring";

export interface ViewerPhoto {
  id: string;
  /** Who took it. Null on a sealed roll, where nothing is attributed. */
  by: string | null;
  takenAt?: string;
  /** Endpoint serving full-resolution bytes. Guests and hosts have different ones. */
  src: string;
}

/** Resistance at the two ends, where there is nothing to drag towards. */
const RUBBER = 0.35;

/**
 * One photograph, full screen, with the rest of the roll either side of it.
 *
 * It used to take a single photo and show it, which meant leaving and re-entering for every
 * frame — on a screen whose entire purpose is looking through an album. It now holds the list
 * and moves within it.
 *
 * The drag is a real gesture rather than a tap target: the strip follows the finger, a flick
 * is projected forward the way iOS projects one, and the hand-off from drag to animation
 * carries the velocity across so there is no stall at the moment you let go. `spring.ts` was
 * written for exactly this and had no callers until now.
 */
export function PhotoViewer({
  photos,
  startIndex,
  onClose,
}: {
  photos: ViewerPhoto[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [offset, setOffset] = useState(0);

  const trackRef = useRef<HTMLDivElement>(null);
  const animation = useRef<ReturnType<typeof spring> | null>(null);
  /* The live gesture, kept out of state: `dx` has to be exact at the moment of release, and
     a flick can outrun a render. */
  const drag = useRef<{ startX: number; dx: number; samples: { v: number; t: number }[] } | null>(
    null,
  );

  useEffect(() => () => animation.current?.stop(), []);

  /** Springs the strip to `to`, then commits the frame change once it has settled. */
  const settle = useCallback((from: number, to: number, velocity: number, nextIndex: number) => {
    animation.current?.stop();
    animation.current = spring({
      from,
      to,
      velocity,
      response: 0.35,
      onFrame: setOffset,
      onRest: () => {
        // Unconditional: landing back on the same frame makes this a no-op, and the offset
        // has to return to zero either way.
        setIndex(nextIndex);
        setOffset(0);
      },
    });
  }, []);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0 || next >= photos.length) return;
      const width = trackRef.current?.clientWidth ?? window.innerWidth;
      settle(0, -delta * width, 0, next);
    },
    [index, photos.length, settle],
  );

  // Back closes the viewer rather than leaving the roll — the layer that was opened is the
  // layer the gesture should take away.
  useEffect(() => {
    window.history.pushState({ mvPhoto: true }, "");
    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (window.history.state?.mvPhoto) window.history.back();
    };
  }, [onClose]);

  // Arrow keys, because this is a web page and half the people looking at a wedding album
  // afterwards are doing it on a laptop.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "ArrowRight") go(1);
      else if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  function onPointerDown(event: React.PointerEvent) {
    animation.current?.stop();
    drag.current = {
      startX: event.clientX,
      dx: 0,
      samples: [{ v: event.clientX, t: performance.now() }],
    };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    const state = drag.current;
    if (!state) return;

    let dx = event.clientX - state.startX;
    // Nothing to move towards at either end, so the strip resists instead of sliding into
    // blank space — the same tell a phone gives you when a list is already at the top.
    const atStart = index === 0 && dx > 0;
    const atEnd = index === photos.length - 1 && dx < 0;
    if (atStart || atEnd) dx *= RUBBER;

    state.dx = dx;
    state.samples.push({ v: event.clientX, t: performance.now() });
    if (state.samples.length > 5) state.samples.shift();
    setOffset(dx);
  }

  function onPointerUp() {
    const state = drag.current;
    if (!state) return;
    drag.current = null;

    const width = trackRef.current?.clientWidth ?? window.innerWidth;
    const velocity = velocityFrom(state.samples);
    const delta = swipeDelta({ dx: state.dx, velocity, width, index, count: photos.length });

    settle(state.dx, -delta * width, velocity, index + delta);
  }

  const photo = photos[index];
  if (!photo) return null;

  // Only the neighbours are mounted. An album can hold hundreds of frames and none of the
  // others are one gesture away from being seen.
  const window_ = [index - 1, index, index + 1].filter((i) => i >= 0 && i < photos.length);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-void">
      <header className="flex items-start justify-between gap-4 px-5 pt-[calc(var(--safe-top)+1.25rem)]">
        <div>
          <p className="display-md text-[22px] text-chalk italic">{photo.by ?? "Someone"}</p>
          <p className="mt-1 text-[14px] text-dust">
            {photo.takenAt ? formatStamp(new Date(photo.takenAt)) : null}
            {photos.length > 1 ? (
              <span className="tabular">
                {photo.takenAt ? " · " : ""}
                {index + 1} of {photos.length}
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-[18px] text-chalk"
        >
          ✕
        </button>
      </header>

      <div
        ref={trackRef}
        className="relative flex flex-1 touch-pan-y items-center overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {window_.map((i) => (
          <div
            key={photos[i].id}
            className="absolute inset-0 flex items-center px-5"
            style={{ transform: `translate3d(calc(${(i - index) * 100}% + ${offset}px), 0, 0)` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[i].src}
              alt={photos[i].by ? `Photo by ${photos[i].by}` : "Photo"}
              draggable={false}
              className="max-h-full w-full object-contain select-none"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-center px-5 pt-4 pb-[calc(var(--safe-bottom)+2rem)]">
        <Pill variant="quiet" onClick={() => window.open(`${photo.src}?download=1`, "_blank")}>
          <Download className="h-4 w-4" />
          Save
        </Pill>
      </div>
    </div>
  );
}
