import type { ReactNode } from "react";

/**
 * A 390x844 device on a wide viewport, so the screens read the way the reference
 * screenshots do. On a real phone it gets out of the way entirely.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-void md:items-center md:py-10">
      <div className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-page md:h-[844px] md:min-h-0 md:w-[390px] md:rounded-[2.5rem] md:border md:border-hair-bright md:shadow-[0_0_80px_-20px_rgba(255,140,0,0.25)]">
        {children}
      </div>
    </div>
  );
}
