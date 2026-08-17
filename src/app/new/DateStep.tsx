"use client";

import { useState } from "react";

import { Calendar } from "@/components/roll/Calendar";
import { TimeWheel } from "@/components/roll/TimeWheel";
import { WizardShell } from "@/components/roll/WizardShell";
import { formatTime, toWall, withWallDay, withWallTime } from "@/lib/format";
import type { DateRange } from "@/lib/roll-config";

/**
 * Start and finish are the same screen with different copy and a different clamp, so they
 * share one component rather than diverging the moment either is edited.
 */
export function DateStep({
  step,
  title,
  subtitle,
  back,
  nextHref,
  value,
  onChange,
  range,
}: {
  step: number;
  title: string;
  subtitle: string;
  back: string;
  nextHref: string;
  value: Date;
  onChange: (next: Date) => void;
  range: DateRange;
}) {
  const [pickingTime, setPickingTime] = useState(false);

  /*
    Wall-clock throughout, because that is what is on the screen.

    Everything on this page — the calendar's day numbers, the time on the button, the range
    the picker is clamped to — is Asia/Kolkata. Editing the underlying instant through UTC
    accessors meant tapping a date selected the day before it, and picking a time set one five
    and a half hours off. See `withWallDay` / `withWallTime`.
  */
  const setTime = (hour: number, minute: number) => {
    onChange(withWallTime(value, hour, minute));
    setPickingTime(false);
  };

  return (
    <>
      <WizardShell
        step={step}
        title={title}
        subtitle={subtitle}
        back={back}
        next={{ label: "Next →", href: nextHref }}
      >
        <Calendar
          value={value}
          onChange={(day) => onChange(withWallDay(value, day))}
          range={range}
        />

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
      </WizardShell>

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
          onDone={setTime}
          onCancel={() => setPickingTime(false)}
        />
      ) : null}
    </>
  );
}
