"use client";

import { useEffect, useState } from "react";

import { formatCountdown } from "@/lib/reveal";

/**
 * Ticks toward a target time. The server renders the initial string so there's no blank
 * frame, and the interval only needs to be fast when the remaining time is short.
 */
export function Countdown({
  target,
  initial,
  onElapsed,
}: {
  target: string;
  initial: string;
  onElapsed?: () => void;
}) {
  const [label, setLabel] = useState(initial);

  useEffect(() => {
    const targetDate = new Date(target);

    function tick() {
      const remainingMs = targetDate.getTime() - Date.now();
      setLabel(formatCountdown(targetDate));
      if (remainingMs <= 0) onElapsed?.();
      // Under an hour the seconds matter; past that, minute resolution is plenty.
      return remainingMs < 60 * 60 * 1000 ? 1000 : 30_000;
    }

    let timer: ReturnType<typeof setTimeout>;
    function schedule() {
      const delay = tick();
      timer = setTimeout(schedule, delay);
    }
    schedule();

    return () => clearTimeout(timer);
  }, [target, onElapsed]);

  return (
    <span className="tabular" suppressHydrationWarning>
      {label}
    </span>
  );
}
