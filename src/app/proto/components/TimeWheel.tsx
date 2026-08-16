"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

import { Pill } from "./Chrome";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Two scrolling columns with the centre row banded, matching the reference's picker.
 *
 * Selection is by tap rather than by momentum scroll: the prototype is for reading the flow,
 * and a hand-rolled inertial wheel would be a day of work that teaches nothing about whether
 * the screen order is right.
 */
export function TimeWheel({
  open,
  hour,
  minute,
  onDone,
  onCancel,
}: {
  open: boolean;
  hour: number;
  minute: number;
  onDone: (hour: number, minute: number) => void;
  onCancel: () => void;
}) {
  const [draftHour, setDraftHour] = useState(hour);
  const [draftMinute, setDraftMinute] = useState(minute);

  if (!open) return null;

  return (
    <div className="animate-fade absolute inset-0 z-40 flex items-center justify-center bg-void/70 px-6 backdrop-blur-sm">
      <div className="w-full max-w-[320px] rounded-3xl bg-surface p-5">
        <div className="relative flex justify-center gap-6">
          {/* The band sits behind both columns so the selected row reads as one row. */}
          <span className="pointer-events-none absolute inset-x-2 top-1/2 h-11 -translate-y-1/2 rounded-2xl bg-hair" />

          <Column
            label="Hour"
            values={HOURS}
            value={draftHour}
            onSelect={setDraftHour}
          />
          <Column
            label="Minute"
            values={MINUTES}
            value={draftMinute}
            onSelect={setDraftMinute}
          />
        </div>

        <div className="mt-5 flex gap-3">
          <Pill variant="quiet" full onClick={onCancel}>
            Cancel
          </Pill>
          <Pill variant="light" full onClick={() => onDone(draftHour, draftMinute)}>
            Done
          </Pill>
        </div>
      </div>
    </div>
  );
}

function Column({
  label,
  values,
  value,
  onSelect,
}: {
  label: string;
  values: number[];
  value: number;
  onSelect: (next: number) => void;
}) {
  return (
    <div
      role="listbox"
      aria-label={label}
      className="no-scrollbar relative h-[176px] w-16 snap-y snap-mandatory overflow-y-auto py-[66px]"
    >
      {values.map((entry) => (
        <button
          key={entry}
          type="button"
          role="option"
          aria-selected={entry === value}
          onClick={() => onSelect(entry)}
          className={cn(
            "tabular flex h-11 w-full snap-center items-center justify-center text-[20px] transition-colors",
            entry === value ? "text-chalk" : "text-dust hover:text-ash",
          )}
        >
          {pad(entry)}
        </button>
      ))}
    </div>
  );
}
