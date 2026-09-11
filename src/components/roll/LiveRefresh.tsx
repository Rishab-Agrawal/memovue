"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * A server-rendered screen, kept current without anybody pulling it down.
 *
 * The host's roll screen used to be asked again at exactly one moment — the reveal — on the
 * theory that nothing else changes it with nobody touching anything. Everything else does:
 * guests' frames landing, people joining, the countdown in the header and on every sealed
 * tile. A host at their own party was refreshing by hand to watch any of it happen.
 *
 * So it asks on the guest album's cadence, and only while somebody is looking: a hidden tab
 * or a locked phone costs nothing, and coming back to one asks at once rather than twenty
 * seconds later. Callers mount this only while the roll can still change.
 *
 * ponytail: refetches the whole screen rather than first asking whether anything moved. It is
 * one host's screen per roll, so that is a few small reads every twenty seconds; put a count
 * check in front of it if these screens are ever many.
 */
export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, 20_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return null;
}
