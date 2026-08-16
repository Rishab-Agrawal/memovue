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

/**
 * Both the screens and the bar read `useSearchParams` — screens to pick their variant, the
 * bar to name itself — so both need a boundary above them or the build refuses to prerender
 * the route. `next dev` does not enforce this; `next build` does.
 */
const barFallback = <div className="h-9 shrink-0 border-t border-hair-bright bg-void" />;
const screenFallback = <div className="min-h-0 flex-1" />;

export function ProtoShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (FULL_WIDTH.has(pathname)) {
    return (
      <div className="flex min-h-dvh flex-col">
        {/* The testid lets tests scope queries to the screen, so the bar's own label can
            never be mistaken for content — "No active rolls" appears in both. */}
        <div data-testid="screen" className="min-h-0 flex-1">
          <Suspense fallback={screenFallback}>{children}</Suspense>
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
        <Suspense fallback={screenFallback}>{children}</Suspense>
      </div>
      <Suspense fallback={barFallback}>
        <ScreenBar />
      </Suspense>
    </PhoneFrame>
  );
}
