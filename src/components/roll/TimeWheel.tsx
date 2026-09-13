"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { useOverlay } from "@/lib/useOverlay";

import { Pill } from "@/components/roll/Chrome";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const pad = (n: number) => String(n).padStart(2, "0");

/** The earliest time this wheel may return, when the day it sits on has a floor. */
interface TimeFloor {
  hour: number;
  minute: number;
}

/**
 * Two scrolling columns with the centre row banded.
 *
 * **Mount it only while it is open.** `hour` and `minute` seed a draft that lives until Done or
 * Cancel; kept mounted, the draft would be stale on the next opening.
 */
export function TimeWheel({
  hour,
  minute,
  floor,
  onDone,
  onCancel,
}: {
  hour: number;
  minute: number;
  /** Hides every time before this one, for a finish that must clear its own start. */
  floor?: TimeFloor | null;
  onDone: (hour: number, minute: number) => void;
  onCancel: () => void;
}) {
  const [draftHour, setDraftHour] = useState(hour);
  const [draftMinute, setDraftMinute] = useState(minute);

  useOverlay(onCancel);

  // Only times at or after the floor are offered; minutes narrow only within the floor's hour.
  const hours = floor ? HOURS.filter((h) => h >= floor.hour) : HOURS;
  const minutes =
    floor && draftHour === floor.hour ? MINUTES.filter((m) => m >= floor.minute) : MINUTES;

  const pickHour = (next: number) => {
    setDraftHour(next);
    // Dropping into the floor's hour can strand the minute below the floor.
    if (floor && next === floor.hour && draftMinute < floor.minute) setDraftMinute(floor.minute);
  };

  return (
    <div
      className="animate-fade fixed inset-0 z-40 flex items-center justify-center bg-void/70 px-6 backdrop-blur-sm"
      onClick={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div className="w-full max-w-[320px] rounded-3xl bg-surface p-5">
        <div className="relative flex justify-center gap-6">
          {/* The band sits behind both columns so the selected row reads as one row. */}
          <span className="pointer-events-none absolute inset-x-2 top-1/2 h-11 -translate-y-1/2 rounded-2xl bg-hair" />

          <Column label="Hour" values={hours} value={draftHour} onSelect={pickHour} />
          <Column label="Minute" values={minutes} value={draftMinute} onSelect={setDraftMinute} />
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
 * One column of the wheel. Invariant: **the banded centre row is the selected row**.
 *
 *   - Scrolling selects whatever is nearest the centre, continuously.
 *   - CSS scroll snapping makes a fling settle exactly on a number.
 *   - A layout effect re-centres when the selection changed elsewhere (opening, or a tap).
 *
 * Offsets are measured from the DOM, so restyling a row cannot desynchronise them.
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
  /** Distinguishes opening the picker from choosing within it: the first must not animate. */
  const opened = useRef(false);
  /**
   * The value this column last aligned to. Only a change in this value animates; a re-filtered
   * list (the hour changed) snaps back without gliding.
   */
  const aligned = useRef(value);
  const frame = useRef<number | null>(null);
  /** Where a scroll we started is heading, so our own glide is not read as a selection. */
  const gliding = useRef<number | null>(null);

  // Read by a scroll listener attached once. Synced in an effect, since render may run twice.
  const valuesRef = useRef(values);
  const valueRef = useRef(value);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    valuesRef.current = values;
    valueRef.current = value;
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const read = () => {
      frame.current = null;

      if (gliding.current !== null) {
        // Our own animation. Let it land, and claim nothing on the way.
        if (Math.abs(list.scrollTop - gliding.current) <= 1) gliding.current = null;
        return;
      }

      const first = list.firstElementChild as HTMLElement | null;
      const row = first?.clientHeight;
      if (!first || !row) return;

      // Which row currently sits under the band.
      const centre = list.scrollTop + (list.clientHeight - row) / 2;
      const index = Math.round((centre - first.offsetTop) / row);
      const clamped = Math.min(valuesRef.current.length - 1, Math.max(0, index));

      const next = valuesRef.current[clamped];
      if (next !== undefined && next !== valueRef.current) onSelectRef.current(next);
    };

    // At most one read per frame.
    const onScroll = () => {
      frame.current ??= requestAnimationFrame(read);
    };

    // A hand on the wheel cancels our glide, including one that stalls short of its target.
    const takeOver = () => {
      gliding.current = null;
    };

    list.addEventListener("scroll", onScroll, { passive: true });
    list.addEventListener("pointerdown", takeOver, { passive: true });
    list.addEventListener("wheel", takeOver, { passive: true });
    return () => {
      list.removeEventListener("scroll", onScroll);
      list.removeEventListener("pointerdown", takeOver);
      list.removeEventListener("wheel", takeOver);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  useLayoutEffect(() => {
    const list = listRef.current;
    const option = selectedRef.current;
    if (!list || !option) return;

    const animate = opened.current && aligned.current !== value;
    opened.current = true;
    aligned.current = value;

    const top = option.offsetTop - (list.clientHeight - option.clientHeight) / 2;

    // Within half a row means the change came from dragging; re-aligning would fight the finger.
    if (Math.abs(list.scrollTop - top) < option.clientHeight / 2) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gliding.current = top;
    list.scrollTo({ top, behavior: animate && !reduced ? "smooth" : "auto" });
  }, [value, values]);

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={label}
      className="no-scrollbar relative h-[176px] w-16 snap-y snap-mandatory overflow-y-auto py-[66px]"
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
