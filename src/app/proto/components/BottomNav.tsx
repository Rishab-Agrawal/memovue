import Link from "next/link";

import { cn } from "@/lib/cn";

import { Roll, Person } from "./Icons";

/**
 * Two items, not three. The reference carries a second product ("Tapes") in the middle of
 * this bar; we don't have one, so the bar is Rolls and the account and nothing else.
 */
export function BottomNav({ current }: { current: "rolls" | "account" }) {
  return (
    <nav className="flex h-14 shrink-0 items-center justify-between border-t border-hair bg-page/95 px-6 backdrop-blur">
      <Link
        href="/proto/home"
        className={cn(
          "marking flex items-center gap-2.5 transition-colors",
          current === "rolls" ? "text-chalk" : "text-dust hover:text-ash",
        )}
      >
        <Roll className="h-5 w-5" />
        Rolls
      </Link>

      <Link
        href="/proto/account"
        aria-label="Account"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
          current === "account" ? "text-chalk" : "text-dust hover:text-ash",
        )}
      >
        <Person className="h-6 w-6" />
      </Link>
    </nav>
  );
}
