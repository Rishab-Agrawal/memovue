import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-md " +
  "transition-[transform,background-color,border-color,opacity] duration-150 " +
  "active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink " +
  "disabled:opacity-45 disabled:pointer-events-none select-none";

const variants: Record<Variant, string> = {
  primary: "bg-ember text-ink hover:bg-ember-bright shadow-[0_6px_24px_-8px_rgba(242,104,60,0.7)]",
  secondary: "bg-ink-high text-paper border border-line hover:border-line-bright hover:bg-[#252129]",
  ghost: "text-paper-dim hover:text-paper hover:bg-ink-high",
  danger: "bg-transparent text-danger border border-danger/35 hover:bg-danger/10",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[14px]",
  md: "h-11 px-5 text-[15px]",
  // Thumb-sized: the guest flow is one-handed on a phone at a party.
  lg: "h-14 px-6 text-[16px]",
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
