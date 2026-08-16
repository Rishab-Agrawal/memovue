"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

import { isWithin, type DateRange } from "../rules";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thur", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** UTC accessors throughout — see the note in `format.ts`. */
function sameDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function utcDay(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day));
}

/**
 * A month grid clamped to a range.
 *
 * Days outside the range render as plain text rather than buttons — the reference greys
 * them out, and making them genuinely non-interactive is what stops a host picking a
 * wedding date three years out or a finish date before the film opens.
 */
export function Calendar({
  value,
  onChange,
  range,
}: {
  value: Date;
  onChange: (next: Date) => void;
  range: DateRange;
}) {
  const [cursor, setCursor] = useState(() => utcDay(value.getUTCFullYear(), value.getUTCMonth(), 1));

  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth();
  const firstWeekday = utcDay(year, month, 1).getUTCDay();
  const daysInMonth = utcDay(year, month + 1, 0).getUTCDate();

  // Six rows of seven, so the grid never changes height as the months change under it.
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(utcDay(year, month, day));
  while (cells.length < 42) cells.push(null);

  const step = (delta: number) => setCursor(utcDay(year, month + delta, 1));

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => step(-1)}
          className="tap px-2 text-[18px] text-ash transition-colors hover:text-flame"
        >
          ←
        </button>
        <p className="display-md text-[22px] text-chalk">
          {MONTHS[month]} {year}
        </p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => step(1)}
          className="tap px-2 text-[18px] text-ash transition-colors hover:text-flame"
        >
          →
        </button>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((day) => (
          <span key={day} className="pb-2 text-[11px] tracking-[0.08em] text-dust">
            {day}
          </span>
        ))}

        {cells.map((day, index) => {
          if (!day) return <span key={index} />;

          const selectable = isWithin(day, range);
          const selected = sameDay(day, value);

          if (!selectable) {
            return (
              <span key={index} className="tabular py-2 text-[15px] text-hair-bright">
                {day.getUTCDate()}
              </span>
            );
          }

          return (
            <button
              key={index}
              type="button"
              onClick={() => onChange(day)}
              className={cn(
                "tabular mx-auto flex h-9 w-9 items-center justify-center rounded-2xl text-[15px] transition-colors",
                selected ? "border border-flame text-flame" : "text-chalk hover:text-flame",
              )}
            >
              {day.getUTCDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
