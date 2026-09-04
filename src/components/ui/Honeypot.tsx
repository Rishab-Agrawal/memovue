"use client";

import { useEffect, useRef } from "react";

/**
 * The browser half of `bot-check`. The field a script fills in, and the clock it beats.
 *
 * Both live here so a form cannot pick up one and forget the other, and so the two of them
 * stay next to the module that judges what they report.
 */

/**
 * The hidden field. Renders nothing anybody can reach.
 *
 * Off-screen rather than `display:none`, because the crudest form-fillers skip what the
 * browser reports as hidden and this one is meant to be filled in. `aria-hidden` and a
 * negative tab index keep it away from the people the trick is not for — a screen reader
 * never announces it and no keyboard lands on it.
 *
 * Controlled by the caller rather than owning its own state: these forms build their
 * submissions by hand instead of posting a `<form>`, so the value has to be somewhere the
 * caller can send from.
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
        // Not a field name any autofill heuristic recognises — a browser filling this in for
        // somebody would lock them out of the form they were trying to send.
        name="subject"
      />
    </div>
  );
}

/**
 * How long this form has been on screen, asked at submit time.
 *
 * Started from an effect rather than during the render that precedes it, which is both what
 * React requires of an impure call and the more honest reading: the clock should start when
 * there is something on screen to fill in.
 *
 * Zero until that has happened. Zero is refused — which is the right default for a caller
 * that never rendered the form at all, and unreachable for one that did.
 */
export function useFormAge(): () => number {
  const openedAt = useRef(0);

  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  return () => (openedAt.current === 0 ? 0 : Date.now() - openedAt.current);
}
