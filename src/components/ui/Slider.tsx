"use client";

import { useId } from "react";

/** The value is set large in mono, like a frame counter, with the track as a hairline. */
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
      <div className="flex items-end justify-between gap-4">
        <label htmlFor={id} className="marking">
          {label}
        </label>
        <span className="flex items-baseline gap-1.5">
          <span className="tabular text-[28px] leading-none text-flame">{value}</span>
          {unit ? <span className="text-[12px] text-dust">{unit}</span> : null}
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
        className="film-slider"
      />

      <div className="flex justify-between">
        <span className="tabular text-[11px] text-dust">{min}</span>
        <span className="tabular text-[11px] text-dust">{max}</span>
      </div>

      {hint ? <p className="text-[13px] leading-snug text-dust">{hint}</p> : null}
    </div>
  );
}
