"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * How long to wait before refetching, or nothing if the moment is not worth waiting for.
 *
 * A moment already past needs no timer — the render that just happened is already on the far
 * side of it. And `setTimeout` cannot hold more than about twenty-five days: past that the
 * delay overflows and the callback fires immediately, which on a screen whose whole job is
 * to refresh itself is not a refresh but a loop. A day is the ceiling here because nothing
 * needs waking after one — a screen left open that long is reloaded by the browser or by the
 * person holding it, and either way it comes back current.
 */
export function refreshDelay(at: number, now: number): number | null {
  const delay = at - now;
  if (delay <= 0 || delay > 86_400_000) return null;
  // A second past the instant, so the render on the other side is unambiguously after it.
  return delay + 1_000;
}

/**
 * One refetch, at a moment that is already known.
 *
 * The host's roll screen is right from the moment it loads and stays right for the whole
 * evening — except for the instant the seal lifts, which is the one thing that changes it
 * with nobody touching anything. That instant is a date on the roll rather than news somebody
 * has to be told, so this waits for it instead of asking every twenty seconds whether it has
 * happened yet. A screen left open all night costs exactly one request, and it is the one
 * that unblurs the photographs.
 *
 * It has to be the server's answer: a sealed page carries no image keys at all, so there is
 * nothing already on this screen that a client could unblur on its own.
 */
export function RefreshAt({ at }: { at: number }) {
  const router = useRouter();

  useEffect(() => {
    const delay = refreshDelay(at, Date.now());
    if (delay === null) return;

    const timer = setTimeout(() => router.refresh(), delay);
    return () => clearTimeout(timer);
  }, [at, router]);

  return null;
}
