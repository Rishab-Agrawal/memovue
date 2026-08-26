"use client";

import { cn } from "@/lib/cn";

/**
 * The label states the resulting condition, not the action — "Everyone can see all photos"
 * when on, "Only host can see all photos" when off. A switch whose label doesn't change is
 * a switch you have to guess at.
 */
export function Toggle({
  on,
  onChange,
  labelOn,
  labelOff,
  name,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  /** Omit both to render the switch alone — the settings row supplies its own label. */
  labelOn?: string;
  labelOff?: string;
  /** The accessible name when there is no visible label. */
  name?: string;
}) {
  const visible = labelOn && labelOff ? (on ? labelOn : labelOff) : null;

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={name ?? (on ? labelOn : labelOff)}
        onClick={() => onChange(!on)}
        className={cn(
          "relative h-[34px] w-[60px] shrink-0 rounded-full transition-colors",
          on ? "bg-flame" : "bg-hair-bright",
        )}
      >
        {/*
          `left-0` is load-bearing. Without a horizontal anchor the knob falls back to its
          static position, which a button centres — so "off" already sat right of middle and
          "on" translated it clean out of the track. Anchored left, the two offsets are the
          same 4px inset from either end: 4, and 60 − 26 − 4.
        */}
        <span
          className={cn(
            "absolute top-1 left-0 h-[26px] w-[26px] rounded-full bg-chalk transition-transform duration-200",
            on ? "translate-x-[30px]" : "translate-x-1",
          )}
        />
      </button>
      {visible ? <p className="text-[15px] text-chalk">{visible}</p> : null}
    </div>
  );
}
