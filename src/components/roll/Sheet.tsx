"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition, type MouseEvent, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { useOverlay } from "@/lib/useOverlay";

/**
 * A bottom sheet over the screen that opened it. Each sheet is a route, so closing is a
 * navigation; the panel animates out while that navigation is already in flight, so it reads
 * as a sheet closing rather than a page reload. The anchor keeps its href for pre-hydration
 * clicks and modifier-clicks.
 */
export function Sheet({
  back,
  title,
  subtitle,
  children,
}: {
  /** Where dismissing lands. */
  back: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [, startTransition] = useTransition();

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    // A transition keeps this tree on screen while the next route loads.
    startTransition(() => router.replace(back));
  }, [back, closing, router]);

  // Escape closes it, and the screen behind stops scrolling while it is open.
  useOverlay(close);

  function dismiss(event: MouseEvent<HTMLAnchorElement>) {
    // Leave "open in a new tab" alone — that is a different request entirely.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    close();
  }

  return (
    // Fixed, not absolute: the screen behind is taller than the viewport.
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      {/* The dimmed area is the dismiss target. */}
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
          "pad-safe-bottom relative max-h-[85%] overflow-y-auto rounded-t-3xl bg-surface",
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
