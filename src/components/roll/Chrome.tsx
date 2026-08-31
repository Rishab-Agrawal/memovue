import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The shapes the reference uses everywhere: a squircle back button, pager dots, and pill
 * buttons. Rounded and filled, unlike the rest of MemoVue — on these screens the reference's
 * geometry wins and only the palette and typeface are ours.
 */

export function BackButton({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-[20px] text-chalk transition-colors hover:text-flame"
    >
      ←
    </Link>
  );
}

export function CloseButton({ href, label = "Close" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-[18px] text-chalk transition-colors hover:text-flame"
    >
      ✕
    </Link>
  );
}

export function PagerDots({ count, current }: { count: number; current: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${current} of ${count}`}>
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            index + 1 === current ? "bg-chalk" : "bg-hair-bright",
          )}
        />
      ))}
    </div>
  );
}

type PillVariant = "light" | "flame" | "quiet";

const pillBase =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] " +
  // A wrapped label turns a pill into a rounded paragraph. Nothing here is long enough to
  // need two lines, so nothing gets them.
  "font-medium whitespace-nowrap transition-colors select-none " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame " +
  "disabled:pointer-events-none disabled:opacity-40";

const pillVariants: Record<PillVariant, string> = {
  // The reference's primary is a white pill. Ours stays white where it sits on a photograph,
  // because orange on a warm cover loses too much contrast.
  light: "bg-chalk text-void hover:bg-white",
  flame: "bg-flame text-void hover:shadow-[0_0_28px_-4px_rgba(255,140,0,0.55)]",
  // The hairline is not decoration: a quiet pill sitting on a `surface` panel is otherwise
  // the same colour as the panel, and reads as bare text rather than as a control.
  quiet: "border border-hair-bright bg-surface text-chalk hover:text-flame",
};

const disabled = "pointer-events-none opacity-40";

export function Pill({
  variant = "quiet",
  full,
  className,
  children,
  ...props
}: {
  variant?: PillVariant;
  full?: boolean;
  children: ReactNode;
} & ComponentPropsWithoutRef<"button">) {
  return (
    <button
      className={cn(pillBase, pillVariants[variant], full && "w-full", className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function PillLink({
  variant = "quiet",
  full,
  inert,
  className,
  children,
  ...props
}: {
  variant?: PillVariant;
  full?: boolean;
  /** Renders as disabled without dropping the element, so tests can still find it. */
  inert?: boolean;
  children: ReactNode;
} & ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      aria-disabled={inert ? "true" : undefined}
      className={cn(pillBase, pillVariants[variant], full && "w-full", inert && disabled, className)}
      {...props}
    >
      {children}
    </Link>
  );
}
