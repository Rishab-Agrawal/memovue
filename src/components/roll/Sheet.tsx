"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type MouseEvent, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The reference's bottom sheet: a drag handle, a serif-scale title, then content. It sits
 * over whichever screen opened it, which is why every sheet route renders its parent screen
 * behind it rather than navigating away.
 *
 * Each of these is a route, so dismissing one is a navigation — and a navigation to a
 * `force-dynamic` page that re-reads the roll and re-signs its photographs is not instant.
 * Left as a plain link the sheet vanished on the click and the screen underneath arrived a
 * beat later, which reads as a page refresh rather than as a sheet closing.
 *
 * So the two are run at once: the panel leaves along the axis it arrived on while the
 * navigation is already in flight behind it. `animate-sheet-out` has existed since the guest
 * album got its sheet — quicker than the entrance and on the inverse curve, because leaving is
 * something the user asked for and making them watch it at arrival speed reads as lag.
 *
 * The anchor is real and keeps its href, so a click that lands before hydration still works,
 * and a modifier-click still opens the roll screen in a new tab.
 */
export function Sheet({
  back,
  title,
  subtitle,
  children,
}: {
  /** Where dismissing lands. Every sheet here is a route, so closing one is a navigation. */
  back: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [, startTransition] = useTransition();

  function dismiss(event: MouseEvent<HTMLAnchorElement>) {
    // Leave "open in a new tab" alone — that is a different request entirely.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    if (closing) return;

    setClosing(true);
    // A transition, so React keeps this tree on screen while the next route loads. Without
    // it the sheet would unmount on the click and there would be nothing left to animate.
    startTransition(() => router.replace(back));
  }

  return (
    /*
      Fixed, not absolute. Every sheet route renders the roll screen behind it, and that
      screen is taller than the viewport — so an absolute overlay stretched to the height of
      the *document* and `justify-end` parked the panel at the bottom of the page. The sheet
      only appeared once you had scrolled the screen underneath it all the way down. An
      overlay belongs to the viewport, which is the one thing that is always on screen.
    */
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      {/*
        The dimmed area is the dismiss target, which is the whole point of dimming it. It was
        an inert div, so tapping away from a sheet did nothing and the only way out was the
        hardware back button.
      */}
      <Link
        href={back}
        replace
        aria-label="Close"
        onClick={dismiss}
        className={cn(
          "absolute inset-0 bg-void/50 backdrop-blur-[2px] transition-opacity duration-[260ms]",
          closing && "opacity-0",
        )}
      />

      <div
        className={cn(
          "relative max-h-[85%] overflow-y-auto rounded-t-3xl bg-surface pb-8",
          closing ? "animate-sheet-out" : "animate-sheet-in",
        )}
      >
        <div className="flex justify-center py-3">
          <span className="h-1 w-10 rounded-full bg-hair-bright" />
        </div>
        <div className="px-5">
          <h2 className="display-md text-[24px] text-chalk">{title}</h2>
          {subtitle ? <p className="mt-2 text-[14px] leading-relaxed text-ash">{subtitle}</p> : null}
          {children}
        </div>
      </div>
    </div>
  );
}
