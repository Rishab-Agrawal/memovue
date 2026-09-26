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

/**
 * The server's clock less this phone's. Every deadline is the server's, and a phone set by hand
 * can be minutes out. Learned once per page load from a live answer, never from a render, which
 * the back button replays however old it is.
 */
let skew = 0;
let asked = false;

function read(): number {
  return Date.now() + skew;
}

function learnSkew() {
  if (asked) return;
  asked = true;
  const sent = Date.now();
  fetch("/api/health", { cache: "no-store" })
    .then((response) => {
      const stamped = Date.parse(response.headers.get("date") ?? "");
      if (Number.isNaN(stamped)) return;
      // Stamped to the second, somewhere in the round trip: its middle is the best guess.
      skew = stamped + 500 - (sent + Date.now()) / 2;
      current = read();
      listeners.forEach((notify) => notify());
    })
    .catch(() => {
      asked = false;
    });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  learnSkew();

  if (!timer) {
    current = read();
    timer = setInterval(() => {
      current = read();
      listeners.forEach((notify) => notify());
    }, TICK_MS);
  }

  // The clock starts at 0 to match the server; this is what replaces it with the real time
  // on the first tick after mount rather than up to thirty seconds later.
  current = read();
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

/** How far this phone's clock is behind the server's, for a deadline that needs the millisecond. */
export function useSkew(): number {
  return useSyncExternalStore(
    subscribe,
    () => skew,
    () => 0,
  );
}
