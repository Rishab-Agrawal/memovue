import type { ReactNode } from "react";

/**
 * The reference's bottom sheet: a drag handle, a serif-scale title, then content. It sits
 * over whichever screen opened it, which is why every sheet route renders its parent screen
 * behind it rather than navigating away.
 */
export function Sheet({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-void/50 backdrop-blur-[2px]">
      <div className="animate-sheet-in max-h-[85%] overflow-y-auto rounded-t-3xl bg-surface pb-8">
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
