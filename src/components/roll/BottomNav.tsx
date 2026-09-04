import Link from "next/link";

import { cn } from "@/lib/cn";

import { Home, Person } from "@/components/roll/Icons";

/**
 * Two items, not three. The reference carries a second product in the middle of this bar and
 * labels its own; we have one product, so the first item is simply home rather than a camera
 * beside the word "Rolls" — naming the only thing there is says nothing.
 *
 * With the label gone both items are glyphs, and each takes half the bar and centres in it.
 * Pinned to the outer corners they read as two unrelated controls with a gap, rather than as
 * a pair. Each half is the tap target, full height, which is also far easier to hit than a
 * 36px circle in a corner.
 */
export function BottomNav({ current }: { current: "rolls" | "account" }) {
  return (
    <nav className="box-content flex h-14 shrink-0 items-stretch border-t border-hair bg-page/95 pb-[var(--safe-bottom)] backdrop-blur">
      <Link
        href="/rolls"
        aria-label="Home"
        aria-current={current === "rolls" ? "page" : undefined}
        className={cn(
          "flex flex-1 items-center justify-center transition-colors",
          current === "rolls" ? "text-chalk" : "text-dust hover:text-ash",
        )}
      >
        <Home className="h-6 w-6" />
      </Link>

      <Link
        href="/account"
        aria-label="Account"
        aria-current={current === "account" ? "page" : undefined}
        className={cn(
          "flex flex-1 items-center justify-center transition-colors",
          current === "account" ? "text-chalk" : "text-dust hover:text-ash",
        )}
      >
        <Person className="h-6 w-6" />
      </Link>
    </nav>
  );
}
