import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Square, flat, no shadow. The rounded-and-softly-shadowed button is the single most
 * over-produced component on the web; this one is a plain rectangle that either burns
 * orange or is drawn with a hairline.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

/*
  The press is on the way down, not the way up.

  `:active` resolves on pointer-down, so the scale lands on contact rather than on release —
  the difference between a control that answers you and one that waits to see if you meant
  it. 60ms in, 180ms back out: the acknowledgement is immediate, the recovery is not
  something you have to watch.
*/
const base =
  "inline-flex items-center justify-center gap-2.5 select-none " +
  "font-medium tracking-[0.01em] " +
  "transition-[color,background-color,border-color,box-shadow,transform] duration-200 " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] " +
  "focus-visible:outline-flame " +
  "active:scale-[0.975] active:duration-[60ms] " +
  "disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  /*
    The glow is the logo's own bloom, not a drop shadow.

    Disabled is stated, never dimmed. Fading an orange fill to 35% on black produced a mud
    brown carrying near-black text — a button that read as broken rather than as not-yet —
    and it was the first thing anyone saw on the join screen. An unavailable primary is now
    drawn, not filled, and its label stays legible.
  */
  primary:
    "bg-flame text-void hover:shadow-[0_0_28px_-4px_rgba(255,140,0,0.55)] " +
    "disabled:bg-transparent disabled:text-dust disabled:shadow-none " +
    "disabled:border disabled:border-hair-bright",
  secondary:
    "border border-hair-bright text-chalk hover:border-flame hover:text-flame " +
    "disabled:border-hair disabled:text-dust",
  ghost: "text-ash hover:text-chalk disabled:text-dust",
  danger:
    "border border-danger/45 text-danger hover:bg-danger/10 " +
    "disabled:border-hair disabled:text-dust",
};

const sizes: Record<Size, string> = {
  // 40px plus the .tap overlay: the label stays small, the target reaches 44.
  sm: "tap h-10 px-4 text-[13px]",
  md: "h-11 px-5 text-[14px]",
  // Still comfortably thumb-sized for the one-handed guest flow, without the oversized
  // slab a marketing CTA turns into at h-14.
  lg: "h-12 px-6 text-[15px]",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  className?: string;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  full,
  className,
  children,
  ...props
}: CommonProps & ComponentPropsWithoutRef<"button">) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], full && "w-full", className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  full,
  className,
  children,
  ...props
}: CommonProps & ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      className={cn(base, variants[variant], sizes[size], full && "w-full", className)}
      {...props}
    >
      {children}
    </Link>
  );
}
