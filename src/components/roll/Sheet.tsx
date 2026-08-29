import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The reference's bottom sheet: a drag handle, a serif-scale title, then content. It sits
 * over whichever screen opened it, which is why every sheet route renders its parent screen
 * behind it rather than navigating away.
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
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      {/*
        The dimmed area is the dismiss target, which is the whole point of dimming it. It was
        an inert div, so tapping away from a sheet did nothing and the only way out was the
        hardware back button.

        A link rather than an onClick, so this stays a server component and works before any
        JavaScript arrives. `replace` because a sheet is a modal: dismissing it should undo
        the entry that opened it, not stack another one that back would walk into again.
      */}
      <Link
        href={back}
        replace
        aria-label="Close"
        className="absolute inset-0 bg-void/50 backdrop-blur-[2px]"
      />

      <div className="animate-sheet-in relative max-h-[85%] overflow-y-auto rounded-t-3xl bg-surface pb-8">
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
