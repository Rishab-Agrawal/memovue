"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { useOverlay } from "@/lib/useOverlay";

import { Pill } from "@/components/roll/Chrome";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const pad = (n: number) => String(n).padStart(2, "0");

/** The earliest time this wheel may return, when the day it sits on has a floor. */
export interface TimeFloor {
  hour: number;
  minute: number;
}

/**
 * Two scrolling columns with the centre row banded, matching the reference's picker.
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

  // A column offers only what may be chosen, rather than showing numbers that would be
  // refused on Done. Minutes narrow only in the floor's own hour; every later hour is whole.
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
 * One column of the wheel, with a standing invariant: **the banded centre row is the selected
 * row**, however the column got there.
 *
 * Three mechanisms, one for each way that can happen, and deliberately no timers.
 *
 *   - Scrolling picks whatever number is nearest the centre, continuously. Requiring a tap
 *     to commit meant a wheel spun to 21 and left a few pixels off still returned the old
 *     value, which is the picker quietly disagreeing with what it is showing.
 *   - CSS scroll snapping decides where a fling comes to rest, so the column always settles
 *     exactly on a number rather than between two. The browser's own momentum physics are
 *     better than anything reimplemented on a timer.
 *   - A layout effect re-centres when the selection changed from somewhere else — opening
 *     the picker, or a tap on an off-centre number.
 *
 * Offsets come from measured geometry rather than from repeating the 44px row height as a
 * constant, so restyling a row cannot quietly desynchronise the three.
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
   * The selection this column last aligned itself to.
   *
   * Only a change in *this* column's value is worth animating. Changing the hour re-filters
   * the minutes — dropping out of the floor's hour puts thirty numbers back above the list,
   * which leaves the column's scroll offset pointing at 00 — and the correction then glided
   * from 00 back down to the minute that was never actually deselected. The number was right
   * the whole time; the wheel just performed a change that had not happened.
   */
  const aligned = useRef(value);
  const frame = useRef<number | null>(null);
  /**
   * Where a scroll *we* started is heading, while it is still heading there.
   *
   * Without it the column reads its own animation as a choice. Tapping 03 from 18 glides
   * through every hour between, and each one on the way past was being committed — so a host
   * who tapped a number and pressed Done before the glide finished got whichever hour
   * happened to be under the band at that instant.
   */
  const gliding = useRef<number | null>(null);

  // The scroll listener is attached once and reads through these, so it never has to be torn
  // down and rebuilt — and so it cannot capture a stale value. Synced in an effect because a
  // ref write during render is a side effect where React may run the same render twice.
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

    // Coalesced to one read per frame: a fling fires scroll far more often than it can
    // possibly change which number is under the band.
    const onScroll = () => {
      frame.current ??= requestAnimationFrame(read);
    };

    // A hand on the wheel outranks anything we were animating, and is also the escape hatch
    // if a glide is left a fraction of a pixel short of its target and never lands.
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

    /*
      While a finger is on the wheel the selection is, by construction, the row nearest the
      band — never more than half a row from it. Scrolling then would yank the column out
      from under the drag, so alignment is only corrected when the change came from
      elsewhere, which always leaves the selection a whole row or more out of place.
    */
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
