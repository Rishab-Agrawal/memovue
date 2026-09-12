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
  onDelete,
}: {
  photos: ViewerPhoto[];
  startIndex: number;
  onClose: () => void;
  /**
   * Takes this photograph out of the album. Given only to the host, who is the person a
   * subject actually asks and the only one here without a shot quota to game.
   */
  onDelete?: (photo: ViewerPhoto) => Promise<void>;
}) {
  const [index, setIndex] = useState(startIndex);
  /*
    The frame on screen is followed by id, not by number. A live wall takes new photographs at
    its head while one is open, and an index held still would slide somebody else's under the
    reader's thumb. Adjusted during render rather than in an effect, so the wrong frame is
    never painted first.
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
  /* The live gesture, kept out of state: `dx` has to be exact at the moment of release, and
     a flick can outrun a render. `id` is the one finger that owns it. */
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
   * Moves `delta` frames, from wherever the strip is at `at` and at whatever speed.
   *
   * The frame change is committed here and now, and the strip rebased around it so that not
   * one pixel moves — rather than committed when the spring comes to rest. A settling spring
   * is interruptible by construction: the next gesture stops it mid-flight, and the rest that
   * would have committed the frame then never arrives. So a swipe taken before the last one
   * landed was measured from the frame the reader had already left, sent back to it, and a
   * fast hand ping-ponged between two photographs without ever reaching the third.
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
    Back closes the viewer rather than leaving the roll — the layer that was opened is the
    layer the gesture should take away. One dummy entry while it is open, taken away again on
    the way out so that leaving by the ✕ does not cost the reader a wasted press of Back.

    Both halves are written to survive being torn down and rebuilt, because they were not.
    The effect used to depend on `onClose`, which in the guest album is a fresh closure every
    twenty seconds off the feed poll; and React's development double-invoke does the same
    thing once, immediately. Either way the cleanup's `back()` — which is asynchronous —
    landed after the rebuild and closed the photograph that had just been opened. In
    development that meant the viewer could not be opened at all.

    So: push only when we are not already standing on the entry, and defer the `back()` far
    enough to see whether anybody still wants it.
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

  // Arrow keys, because this is a web page and half the people looking at a wedding album
  // afterwards are doing it on a laptop.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // One finger owns the gesture. A second landing mid-swipe would restart the drag from
    // its own position, which is a jump rather than a swipe. `isPrimary` rather than "a drag
    // is already open", so a release we somehow never heard cannot lock the viewer shut.
    if (!event.isPrimary) return;

    // Take over a settling spring from where it actually is, so the strip stays under the
    // finger instead of snapping back to the frame it was in the middle of leaving.
    const at = animation.current?.value() ?? 0;
    animation.current?.stop();
    drag.current = {
      id: event.pointerId,
      startX: event.clientX - at,
      dx: at,
      samples: [{ v: event.clientX, t: performance.now() }],
    };
    // The track rather than the photograph under the finger: the track is always mounted, so
    // the release is delivered here even once the finger has left the frame it started on.
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    const state = drag.current;
    if (!state || event.pointerId !== state.id) return;

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
   * Saving, without leaving the cached domain.
   *
   * This used to open a route that redirected to a signed URL carrying a
   * `Content-Disposition` — the only way to make a browser save a file rather than display
   * it, and a signed URL is uncacheable by construction. So the one photograph everybody at
   * the wedding wants was fetched from the bucket once per guest.
   *
   * Reading it into a blob puts the filename in our hands instead of in a header, which
   * means the bytes can come from the same cached URL the viewer is already showing — very
   * often out of the browser's own cache, with no request at all. The bucket allows this
   * origin, which is why the cross-origin read is permitted.
   *
   * The fallback matters more than the happy path: if the fetch is refused for any reason,
   * opening the picture is still better than a button that does nothing.
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
      // Not immediately: Firefox has historically dropped the download if the object URL is
      // revoked in the same tick as the click.
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch {
      window.open(target.src, "_blank");
    } finally {
      setSaving(false);
    }
  }

  /**
   * The link rather than the file.
   *
   * The photograph is already being read from the cached domain, so the same URL handed to
   * somebody outside the roll is served from the edge and costs us nothing beyond the first
   * read. Sharing the picture and sharing the bytes would be the same thing at a much higher
   * price.
   */
  async function share(target: ViewerPhoto) {
    if ((await shareOrCopy({ url: target.src })) !== "copied") return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const photo = photos[index];
  if (!photo) return null;

  // Only the neighbours are mounted. An album can hold hundreds of frames and none of the
  // others are one gesture away from being seen.
  const window_ = [index - 1, index, index + 1].filter((i) => i >= 0 && i < photos.length);

  /*
    Portalled to the body rather than left where it was opened from.

    Both walls render this inside the stack that holds the grid, and those stacks are
    `space-y-4` — which puts a 16px bottom margin on every child but the last. A margin on a
    `fixed inset-0` element shortens it, so the overlay stopped 16px above the bottom of the
    screen and left a strip of the album showing underneath a photograph that is meant to be
    the whole screen. Out here nothing a parent does to its children can reach it, including
    a transform, which would break `fixed` far more thoroughly than a margin.

    No SSR guard: every call site mounts this from a click, so there is always a document.
  */
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

      {/* A grid rather than a row, so Save sits in the middle of the bar whether or not the
          host's Remove is there to balance it: two columns for a guest, three for the host. */}
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

        {/* The viewer is a stacking context of its own, so the box lands over the photograph
            rather than behind it. It used to be the browser's own confirm on the grounds that
            a second overlay was not worth unwinding — but the one screen in the product where
            a picture is the entire frame is the last place to hand somebody a system font. */}
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
