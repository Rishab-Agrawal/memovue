import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** One row of a settings list: icon, label, current value, chevron. Hairlines between rows, no cards. */
export function SettingRow({
  icon,
  label,
  value,
  href,
  after,
  trailing,
  tone = "normal",
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  href?: string;
  /** Sits right after the label (e.g. a help icon), keeping `trailing` aligned with other rows. */
  after?: ReactNode;
  /** Replaces the chevron — used by the visibility row, which carries a switch. */
  trailing?: ReactNode;
  tone?: "normal" | "danger";
}) {
  const body = (
    <>
      <span className={cn("shrink-0", tone === "danger" ? "text-danger" : "text-ash")}>{icon}</span>
      {/* Label and value each truncate to one line. */}
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={cn("truncate text-[15px]", tone === "danger" ? "text-danger" : "text-chalk")}
        >
          {label}
        </span>
        {after}
      </span>
      {value ? <span className="max-w-[42%] truncate text-[14px] text-dust">{value}</span> : null}
      {trailing ?? (href ? <span className="shrink-0 text-[14px] text-dust">›</span> : null)}
    </>
  );

  const className = cn(
    "flex h-14 w-full items-center gap-3.5 border-b border-hair-bright/60 text-left last:border-b-0",
    // Only a row that navigates reacts to a press; on a switch row the switch is the control.
    href && "transition-[color,scale] duration-150 hover:text-flame active:scale-[0.99]",
  );

  if (href && !href.startsWith("/")) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel="noreferrer"
        className={className}
      >
        {body}
      </a>
    );
  }

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
