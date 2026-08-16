"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import { MONTHS, WEEKDAYS, fromWall, monthGrid, sameWallDay, toWall } from "@/lib/format";
import { isWithin, type DateRange } from "@/lib/roll-config";

/**
 * A month grid clamped to a range.
 *
 * Days outside the range render as plain text rather than buttons — the reference greys them
 * out, and making them genuinely non-interactive is what stops a host picking a wedding date
 * three years out or a finish date before the roll opens.
 *
 * Every date here is a wall-clock day in the app's zone, not a UTC one. A calendar that
 * disagrees with the clock beside it by five and a half hours is a calendar that hands back
 * the wrong day for anyone shooting after 6:30pm.
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
  const [cursor, setCursor] = useState(() => {
    const wall = toWall(value);
    return { year: wall.year, month: wall.month };
  });

  const { firstWeekday, days } = monthGrid(cursor.year, cursor.month);

  // Six rows of seven, so the grid never changes height as months change under it.
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= days; day += 1) cells.push(fromWall(cursor.year, cursor.month, day));
  while (cells.length < 42) cells.push(null);

  const step = (delta: number) => {
    const next = new Date(Date.UTC(cursor.year, cursor.month + delta, 1));
    setCursor({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  };

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
          {MONTHS[cursor.month]} {cursor.year}
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

          const label = toWall(day).day;
          const selectable = isWithin(day, range);

          if (!selectable) {
            return (
              <span key={index} className="tabular py-2 text-[15px] text-hair-bright">
                {label}
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
                sameWallDay(day, value)
                  ? "border border-flame text-flame"
                  : "text-chalk hover:text-flame",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
