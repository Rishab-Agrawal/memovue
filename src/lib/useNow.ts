"use client";

import { useSyncExternalStore } from "react";

/**
 * The current time, as a subscribable value.
 *
 * Reading `Date.now()` during render is impure — React may re-render at any moment and the
 * number would jump unpredictably — and every place that wanted it here is a countdown,
 * which ought to tick anyway.
 *
 * `useSyncExternalStore` rather than state-in-an-effect: the clock genuinely is an external
 * source, one interval is shared by every countdown on the page instead of one each, and the
 * server snapshot is a fixed 0 so a countdown can never cause a hydration mismatch. Callers
 * get 0 on the first paint and a real time immediately after mount.
 */
const TICK_MS = 30_000;

let current = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((notify) => notify());
    }, TICK_MS);
  }

  // The clock starts at 0 to match the server; this is what replaces it with the real time
  // on the first tick after mount rather than up to thirty seconds later.
  current = Date.now();
  queueMicrotask(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 0,
  );
}
