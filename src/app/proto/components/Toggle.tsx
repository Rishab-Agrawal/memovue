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
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  labelOn: string;
  labelOff: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={on ? labelOn : labelOff}
        onClick={() => onChange(!on)}
        className={cn(
          "relative h-[34px] w-[60px] shrink-0 rounded-full transition-colors",
          on ? "bg-flame" : "bg-hair-bright",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-[26px] w-[26px] rounded-full bg-chalk transition-transform duration-200",
            on ? "translate-x-[30px]" : "translate-x-1",
          )}
        />
      </button>
      <p className="text-[15px] text-chalk">{on ? labelOn : labelOff}</p>
    </div>
  );
}
