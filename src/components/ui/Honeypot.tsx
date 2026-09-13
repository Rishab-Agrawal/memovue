"use client";

import { useEffect, useRef } from "react";

/** The browser half of `bot-check`: the hidden field and the form clock. */

/**
 * The hidden field. Off-screen rather than `display:none`, since crude form-fillers skip hidden
 * inputs; `aria-hidden` and `tabIndex={-1}` keep it from screen readers and keyboards.
 * Controlled, because these forms build their submissions by hand.
 */
export function Honeypot({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        // A name no autofill heuristic recognises, so a browser never fills it in for a person.
        name="subject"
      />
    </div>
  );
}

/** How long this form has been on screen, asked at submit time. Zero until mounted, which is refused. */
export function useFormAge(): () => number {
  const openedAt = useRef(0);

  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  return () => (openedAt.current === 0 ? 0 : Date.now() - openedAt.current);
}
