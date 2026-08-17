"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

import { Pill } from "@/components/roll/Chrome";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Two scrolling columns with the centre row banded, matching the reference's picker.
 *
 * Selection is by tap rather than by momentum scroll: a hand-rolled inertial wheel is a day
 * of work, and tapping a number is unambiguous on a phone in a way that flinging past it is
 * not.
 *
 * **Mount it only while it is open.** `hour` and `minute` seed a draft that the wheel edits
 * until Done or Cancel, and a draft is only correct for the opening it was seeded for — so
 * its lifetime has to be that opening. Rendering this permanently behind an `open` flag is
 * what previously froze the draft at whatever the time was on first render, which made the
 * picker appear to ignore the value it was given and made Cancel keep the change.
 */
export function TimeWheel({
  hour,
  minute,
  onDone,
  onCancel,
}: {
  hour: number;
  minute: number;
  onDone: (hour: number, minute: number) => void;
  onCancel: () => void;
}) {
  const [draftHour, setDraftHour] = useState(hour);
  const [draftMinute, setDraftMinute] = useState(minute);

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

/**
 * One column of the wheel, with a standing invariant: **the banded centre row is the selected
 * row.**
 *
 * Without that, the band is decoration that contradicts the thing it sits on. A column of 24
 * hours opens scrolled to the top, so a roll set for 18:00 showed the band over `02` — the
 * picker appeared to have forgotten the time it was handed, and the number a host was about
 * to trust was not the number that would be saved.
 *
 * So the column scrolls its selection to the centre: instantly on open, and smoothly when a
 * new value is tapped. Offsets come from measured geometry rather than from repeating the
 * 44px row height as a constant, so restyling a row cannot quietly desynchronise the two.
 */
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
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  // Distinguishes opening the picker from choosing within it: the first should not animate.
  const settled = useRef(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    const option = selectedRef.current;
    if (!list || !option) return;

    const top = option.offsetTop - (list.clientHeight - option.clientHeight) / 2;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    list.scrollTo({ top, behavior: settled.current && !reduced ? "smooth" : "auto" });
    settled.current = true;
  }, [value]);

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={label}
      className="no-scrollbar relative h-[176px] w-16 overflow-y-auto py-[66px]"
    >
      {values.map((entry) => (
        <button
          key={entry}
          ref={entry === value ? selectedRef : undefined}
          type="button"
          role="option"
          aria-selected={entry === value}
          onClick={() => onSelect(entry)}
          className={cn(
            "tabular flex h-11 w-full items-center justify-center text-[20px] transition-colors",
            entry === value ? "text-chalk" : "text-dust hover:text-ash",
          )}
        >
          {pad(entry)}
        </button>
      ))}
    </div>
  );
}
