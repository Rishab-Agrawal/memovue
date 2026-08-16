"use client";

import { useState } from "react";

import { Calendar } from "@/components/roll/Calendar";
import { TimeWheel } from "@/components/roll/TimeWheel";
import { WizardShell } from "@/components/roll/WizardShell";
import { formatTime } from "@/lib/format";
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

  // UTC accessors throughout — see the note in `format.ts`.
  const setDay = (day: Date) => {
    const next = new Date(day);
    next.setUTCHours(value.getUTCHours(), value.getUTCMinutes(), 0, 0);
    onChange(next);
  };

  const setTime = (hour: number, minute: number) => {
    const next = new Date(value);
    next.setUTCHours(hour, minute, 0, 0);
    onChange(next);
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
        <Calendar value={value} onChange={setDay} range={range} />

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

      <TimeWheel
        open={pickingTime}
        hour={value.getUTCHours()}
        minute={value.getUTCMinutes()}
        onDone={setTime}
        onCancel={() => setPickingTime(false)}
      />
    </>
  );
}
