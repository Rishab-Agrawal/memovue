"use client";

import { useState } from "react";

import { Calendar } from "@/components/roll/Calendar";
import { TimeWheel } from "@/components/roll/TimeWheel";
import { formatTime, sameWallDay, toWall, withWallDay, withWallTime } from "@/lib/format";
import type { DateRange } from "@/lib/roll-config";

/**
 * A day and a time, clamped to a range.
 *
 * Lifted out of the wizard's date step when the settings sheet needed the same control to let
 * a host move a roll's closing time. The wizard's version of it is the only one that has ever
 * been correct about wall-clock arithmetic, and a second copy of that would be a second place
 * to get it wrong.
 *
 * Wall-clock throughout, because that is what is on the screen. Everything here — the
 * calendar's day numbers, the time on the button, the floor the picker is clamped to — is
 * Asia/Kolkata. Editing the underlying instant through UTC accessors meant tapping a date
 * selected the day before it, and picking a time set one five and a half hours off. See
 * `withWallDay` / `withWallTime`.
 */
export function DatePick({
  value,
  onChange,
  range,
  notBefore,
}: {
  value: Date;
  onChange: (next: Date) => void;
  range: DateRange;
  /** The earliest instant this may return. The finish has one; the start does not. */
  notBefore?: Date;
}) {
  const [pickingTime, setPickingTime] = useState(false);

  const commit = (next: Date) => {
    // The calendar works in whole days and keeps the time of day, so tapping the earliest
    // permitted day can still land before the floor within it. One clamp on the way out
    // covers both controls.
    onChange(notBefore && next.getTime() < notBefore.getTime() ? notBefore : next);
  };

  /*
    A floor only bites on the day it falls on. On any later day every hour is available, and
    passing one down regardless would hide the small hours of a two-day event.
  */
  const floor =
    notBefore && sameWallDay(value, notBefore)
      ? { hour: toWall(notBefore).hour, minute: toWall(notBefore).minute }
      : null;

  return (
    <>
      <Calendar value={value} onChange={(day) => commit(withWallDay(value, day))} range={range} />

      <div className="mt-6 flex items-center justify-between border-t border-hair pt-5">
        <p className="marking">Time</p>
        <button
          type="button"
          onClick={() => setPickingTime(true)}
          className="tabular rounded-2xl bg-surface px-5 py-3 text-[16px] text-chalk transition-colors hover:text-flame"
        >
          {formatTime(value)}
        </button>
      </div>

      {/*
        Mounted only while it is open, so its draft starts from the time actually on the
        button every time. Kept mounted behind an `open` prop, the draft was seeded once on
        first render and then never again: reopening the picker showed a stale time, and
        Cancel kept the change instead of discarding it.
      */}
      {pickingTime ? (
        <TimeWheel
          hour={toWall(value).hour}
          minute={toWall(value).minute}
          floor={floor}
          onDone={(hour, minute) => {
            commit(withWallTime(value, hour, minute));
            setPickingTime(false);
          }}
          onCancel={() => setPickingTime(false)}
        />
      ) : null}
    </>
  );
}
