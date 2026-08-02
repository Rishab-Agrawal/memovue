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

const base =
  "inline-flex items-center justify-center gap-2.5 select-none " +
  "font-medium tracking-[0.01em] transition-all duration-200 " +
  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[3px] " +
  "focus-visible:outline-flame active:translate-y-px " +
  "disabled:opacity-35 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  // The glow is the logo's own bloom, not a drop shadow.
  primary: "bg-flame text-void hover:shadow-[0_0_28px_-4px_rgba(255,140,0,0.55)]",
  secondary: "border border-hair-bright text-chalk hover:border-flame hover:text-flame",
  ghost: "text-ash hover:text-chalk",
  danger: "border border-danger/45 text-danger hover:bg-danger/10",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px]",
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
