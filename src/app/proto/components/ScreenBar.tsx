"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { neighbours, screenAt } from "../screens";

/**
 * The only chrome the prototype adds. It sits on VOID behind a hairline so it can never be
 * mistaken for product UI.
 */
export function ScreenBar() {
  const pathname = usePathname();
  const variant = useSearchParams().get("v");
  const path = variant ? `${pathname}?v=${variant}` : pathname;

  const current = screenAt(path);
  const { prev, next } = neighbours(path);

  return (
    <nav className="flex shrink-0 items-center justify-between gap-3 border-t border-hair-bright bg-void px-3 py-2 text-[12px]">
      {prev ? (
        <Link href={prev.path} className="tap text-dust transition-colors hover:text-flame">
          ‹ prev
        </Link>
      ) : (
        <span className="text-hair-bright">‹ prev</span>
      )}

      <Link
        href="/proto"
        data-testid="screen-name"
        className="truncate text-center text-ash transition-colors hover:text-flame"
      >
        {current?.name ?? (pathname === "/proto" ? "All screens" : "unregistered")}
      </Link>

      {next ? (
        <Link href={next.path} className="tap text-dust transition-colors hover:text-flame">
          next ›
        </Link>
      ) : (
        <span className="text-hair-bright">next ›</span>
      )}
    </nav>
  );
}
