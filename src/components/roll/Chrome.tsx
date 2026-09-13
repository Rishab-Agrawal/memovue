import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { ArrowLeft, Close, Gear } from "@/components/roll/Icons";
import { cn } from "@/lib/cn";

/** The small controls every screen shares: squircle chrome buttons, steppers and pills. */

/** Back, close and settings are the same square. */
const chromeButton =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface text-chalk " +
  "transition-[color,background-color,transform] duration-150 hover:bg-hair-bright hover:text-flame " +
  "active:scale-[0.94] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-flame";

function ChromeLink({
  href,
  label,
  icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  /** Runs on a client-side navigation; `preventDefault()` inside it cancels the departure. */
  onNavigate?: ComponentPropsWithoutRef<typeof Link>["onNavigate"];
}) {
  return (
    <Link href={href} onNavigate={onNavigate} aria-label={label} className={chromeButton}>
      {icon}
    </Link>
  );
}

export function BackButton({
  href,
  label = "Back",
  onNavigate,
}: {
  href: string;
  label?: string;
  onNavigate?: ComponentPropsWithoutRef<typeof Link>["onNavigate"];
}) {
  return (
    <ChromeLink
      href={href}
      label={label}
      onNavigate={onNavigate}
      icon={<ArrowLeft className="h-[18px] w-[18px]" />}
    />
  );
}

/** A link on the screens that are routes, a button on the ones that are overlays. */
export function CloseButton({
  href,
  onClick,
  label = "Close",
}: {
  href?: string;
  onClick?: () => void;
  label?: string;
}) {
  const icon = <Close className="h-4 w-4" />;

  if (href) return <ChromeLink href={href} label={label} icon={icon} />;

  return (
    <button type="button" onClick={onClick} aria-label={label} className={chromeButton}>
      {icon}
    </button>
  );
}

export function SettingsButton({ href, label = "Roll settings" }: { href: string; label?: string }) {
  return <ChromeLink href={href} label={label} icon={<Gear className="h-[18px] w-[18px]" />} />;
}

/** One end of a stepper. Circular, so it never reads as one of the rectangular tiles. */
export function StepButton({
  label,
  glyph,
  small,
  disabled,
  onClick,
}: {
  label: string;
  glyph: string;
  /** For a stepper that has to fit inside a settings row rather than carry a screen. */
  small?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-hair-bright text-chalk transition-colors hover:border-flame hover:text-flame disabled:pointer-events-none disabled:opacity-25",
        small ? "h-8 w-8 text-[17px]" : "h-13 w-13 text-[24px]",
      )}
    >
      {glyph}
    </button>
  );
}

type PillVariant = "light" | "flame" | "quiet";

const pillBase =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] " +
  "font-medium whitespace-nowrap select-none active:scale-[0.97] " +
  "transition-[color,background-color,box-shadow,scale] duration-150 " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame " +
  "disabled:pointer-events-none disabled:opacity-40";

const pillVariants: Record<PillVariant, string> = {
  // White where it sits on a photograph, where orange loses contrast.
  light: "bg-chalk text-void hover:bg-white",
  flame: "bg-flame text-void hover:shadow-[0_0_28px_-4px_rgba(255,140,0,0.55)]",
  // The hairline keeps a quiet pill on a `surface` panel from reading as bare text.
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

/** A screen that is only a sentence: the crash boundary, 404s, an unknown roll code. */
export function Notice({
  title,
  children,
  actions,
}: {
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="display text-[28px] text-chalk">{title}</h1>
      {children ? <p className="max-w-xs text-[15px] text-ash">{children}</p> : null}
      {actions}
    </div>
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
