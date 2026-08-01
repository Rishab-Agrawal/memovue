"use client";

import { useId } from "react";

export function Slider({
  label,
  hint,
  min,
  max,
  value,
  onChange,
  unit,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-[13px] font-medium tracking-wide text-paper-dim">
          {label}
        </label>
        <span className="font-display text-[1.75rem] leading-none text-ember tabular">
          {value}
          {unit ? <span className="ml-1.5 text-[15px] text-paper-dim">{unit}</span> : null}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-ink-high accent-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
      />
      {hint ? <p className="text-[13px] leading-snug text-paper-faint">{hint}</p> : null}
    </div>
  );
}
