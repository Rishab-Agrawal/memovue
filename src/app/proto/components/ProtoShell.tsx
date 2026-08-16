"use client";

import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { PhoneFrame } from "./PhoneFrame";
import { ScreenBar } from "./ScreenBar";

/**
 * The marketing page is a desktop web page, not a screen in the app. Framing it inside a
 * 390px phone would misrepresent the one route that genuinely has a wide layout, so it runs
 * full width and everything else gets the phone.
 */
const FULL_WIDTH = new Set(["/proto/marketing"]);

const barFallback = <div className="h-9 shrink-0 border-t border-hair-bright bg-void" />;

export function ProtoShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (FULL_WIDTH.has(pathname)) {
    return (
      <div className="flex min-h-dvh flex-col">
        {/* The testid lets tests scope queries to the screen, so the bar's own label can
            never be mistaken for content — "No active films" appears in both. */}
        <div data-testid="screen" className="min-h-0 flex-1">
          {children}
        </div>
        <Suspense fallback={barFallback}>
          <ScreenBar />
        </Suspense>
      </div>
    );
  }

  return (
    <PhoneFrame>
      <div data-testid="screen" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {children}
      </div>
      <Suspense fallback={barFallback}>
        <ScreenBar />
      </Suspense>
    </PhoneFrame>
  );
}
