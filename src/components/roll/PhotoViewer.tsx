"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Pill } from "@/components/roll/Chrome";
import { useConfirm } from "@/components/roll/Confirm";
import { Download, Link as LinkIcon, Send, Trash } from "@/components/roll/Icons";
import { formatStamp } from "@/lib/format";
import { shareOrCopy } from "@/lib/share";
import { useOverlay } from "@/lib/useOverlay";
import { spring, swipeDelta, velocityFrom } from "@/lib/spring";

export interface ViewerPhoto {
  id: string;
  /** Who took it. Null on a sealed roll, where nothing is attributed. */
  by: string | null;
  takenAt?: string;
  /** The full-resolution original, straight off the cached domain. */
  src: string;
}

/** Resistance at the two ends, where there is nothing to drag towards. */
const RUBBER = 0.35;

/**
 * One photograph full screen, swipeable through the rest of the roll. The strip follows the
 * finger, and a flick carries its velocity into the spring (see `spring.ts`).
 */
export function PhotoViewer({
  photos,
  startIndex,
  onClose,
  onDelete,
}: {
  photos: ViewerPhoto[];
  startIndex: number;
  onClose: () => void;
  /** Takes this photograph out of the album. Given only to the host. */
  onDelete?: (photo: ViewerPhoto) => Promise<void>;
}) {
  const [index, setIndex] = useState(startIndex);
  /*
    The frame on screen is followed by id, not index: a live wall adds photos at its head while
    one is open. Adjusted during render so the wrong frame is never painted.
  */
  const [seen, setSeen] = useState(photos);
  if (seen !== photos) {
    setSeen(photos);
    const moved = photos.findIndex((photo) => photo.id === seen[index]?.id);
    if (moved !== -1) setIndex(moved);
  }
  const [offset, setOffset] = useState(0);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const trackRef = useRef<HTMLDivElement>(null);
  const animation = useRef<ReturnType<typeof spring> | null>(null);
  /* The live gesture, kept out of state so `dx` is exact at release. `id` is the owning finger. */
  const drag = useRef<{
    id: number;
    startX: number;
    dx: number;
    samples: { v: number; t: number }[];
  } | null>(null);
  /* Read through a ref by the history effect below, so that effect can run once on mount. */
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  /* Whether the viewer is still on screen, for the history effect's deferred tidy-up. */
  const live = useRef(false);

  useEffect(() => () => animation.current?.stop(), []);

  // Escape, and the roll behind held still while a photograph is open over it.
  useOverlay(onClose);

  /**
   * Moves `delta` frames from wherever the strip is. The index is committed now and the strip
   * rebased around it, not when the spring rests — an interrupted spring would otherwise never
   * commit, and fast swipes would bounce between two frames.
   */
  const shift = useCallback((delta: number, at: number, velocity: number) => {
    animation.current?.stop();
    const width = trackRef.current?.clientWidth ?? window.innerWidth;
    const from = at + delta * width;
    setIndex((current) => current + delta);
    setOffset(from);
    animation.current = spring({ from, to: 0, velocity, response: 0.35, onFrame: setOffset });
  }, []);

  const go = useCallback(
    (delta: number) => {
      if (index + delta < 0 || index + delta >= photos.length) return;
      // Whatever is still in flight is carried, so a held arrow key runs rather than stutters.
      const live = animation.current;
      shift(delta, live?.value() ?? 0, live?.velocity() ?? 0);
    },
    [index, photos.length, shift],
  );

  /*
    Back closes the viewer: one history entry while it is open, removed on the way out.

    Written to survive being torn down and rebuilt (StrictMode, or a parent re-rendering): push
    only when not already on the entry, and defer the `back()` to see if the viewer came back.
  */
  useEffect(() => {
    live.current = true;
    if (!window.history.state?.mvPhoto) window.history.pushState({ mvPhoto: true }, "");

    const onPop = () => close.current();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      live.current = false;
      queueMicrotask(() => {
        if (!live.current && window.history.state?.mvPhoto) window.history.back();
      });
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // One finger owns the gesture; a second would restart the drag with a jump.
    if (!event.isPrimary) return;

    // Take over a settling spring from where it actually is.
    const at = animation.current?.value() ?? 0;
    animation.current?.stop();
    drag.current = {
      id: event.pointerId,
      startX: event.clientX - at,
      dx: at,
      samples: [{ v: event.clientX, t: performance.now() }],
    };
    // The track is always mounted, so the release arrives here even off the starting frame.
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    const state = drag.current;
    if (!state || event.pointerId !== state.id) return;

    let dx = event.clientX - state.startX;
    const atStart = index === 0 && dx > 0;
    const atEnd = index === photos.length - 1 && dx < 0;
    if (atStart || atEnd) dx *= RUBBER;

    state.dx = dx;
    state.samples.push({ v: event.clientX, t: performance.now() });
    if (state.samples.length > 5) state.samples.shift();
    setOffset(dx);
  }

  function onPointerUp(event: React.PointerEvent) {
    const state = drag.current;
    if (!state || event.pointerId !== state.id) return;
    drag.current = null;

    const width = trackRef.current?.clientWidth ?? window.innerWidth;
    const velocity = velocityFrom(state.samples);
    shift(
      swipeDelta({ dx: state.dx, velocity, width, index, count: photos.length }),
      state.dx,
      velocity,
    );
  }

  /**
   * Saves via a blob, so the bytes come from the cached URL already on screen and we name the
   * file ourselves. If the fetch is refused, opening the picture beats a dead button.
   */
  async function save(target: ViewerPhoto) {
    if (saving) return;
    setSaving(true);
    try {
      const response = await fetch(target.src);
      if (!response.ok) throw new Error(String(response.status));

      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = href;
      link.download = `memovue-${target.id}.jpg`;
      document.body.append(link);
      link.click();
      link.remove();
      // Not immediately: Firefox can drop the download if revoked in the same tick.
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch {
      window.open(target.src, "_blank");
    } finally {
      setSaving(false);
    }
  }

  /** Shares the cached URL rather than the file: served from the edge, it costs nothing. */
  async function share(target: ViewerPhoto) {
    if ((await shareOrCopy({ url: target.src })) !== "copied") return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const photo = photos[index];
  if (!photo) return null;

  // Only the neighbours are mounted.
  const window_ = [index - 1, index, index + 1].filter((i) => i >= 0 && i < photos.length);

  // Portalled, so no parent margin or transform can shorten or break the `fixed` overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-void">
      <header className="flex items-start justify-between gap-4 px-5 pt-[calc(var(--safe-top)+1.25rem)]">
        <div>
          <p className="display-sm text-[19px] text-chalk">{photo.by ?? "Someone"}</p>
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
        className="relative flex flex-1 touch-none items-center overflow-hidden"
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

      {/* A grid, so Save stays centred with or without the host's Remove. */}
      <div
        className={`grid ${onDelete ? "grid-cols-3" : "grid-cols-2"} justify-items-center px-5 pt-4 pb-[calc(var(--safe-bottom)+2rem)]`}
      >
        <Pill variant="quiet" className="px-3 text-[14px]" onClick={() => void share(photo)}>
          {copied ? (
            <>
              <LinkIcon className="h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Share
            </>
          )}
        </Pill>

        <Pill
          variant="quiet"
          className="px-3 text-[14px]"
          disabled={saving}
          onClick={() => void save(photo)}
        >
          <Download className="h-4 w-4" />
          {saving ? "Saving…" : "Save"}
        </Pill>

        {onDelete ? (
          <Pill
            variant="quiet"
            disabled={deleting}
            className="px-3 text-[14px] text-danger"
            onClick={() =>
              confirm({
                title: "Remove this photograph?",
                body: "It leaves the album for everyone, and cannot be recovered.",
                action: "Remove",
                danger: true,
                onConfirm: () => {
                  setDeleting(true);
                  void onDelete(photo).finally(() => setDeleting(false));
                },
              })
            }
          >
            <Trash className="h-4 w-4" />
            {deleting ? "Removing…" : "Remove"}
          </Pill>
        ) : null}
      </div>

      {confirmDialog}
    </div>,
    document.body,
  );
}
