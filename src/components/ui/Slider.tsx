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
  const noteId = `${id}-note`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-4">
        <label htmlFor={id} className="marking">
          {label}
        </label>
        <span className="flex items-baseline gap-1.5">
          <span className="display tabular text-[28px] leading-none text-flame">{value}</span>
          {unit ? <span className="text-[12px] text-ash">{unit}</span> : null}
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
        aria-describedby={hint ? noteId : undefined}
        className="film-slider"
      />

      <div className="flex justify-between">
        <span className="tabular text-[12px] text-dust">{min}</span>
        <span className="tabular text-[12px] text-dust">{max}</span>
      </div>

      {hint ? (
        <p id={noteId} className="mt-1 text-[13px] leading-snug text-ash">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
