import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * One row of a settings list: icon, label, current value, chevron. The value is what makes
 * these rows worth reading — a list of labels alone tells a host nothing about how their
 * roll is currently configured.
 *
 * A hairline between rows, not a filled tile per row. Every one of these used to be its own
 * rounded `surface` block with a gap under it — the reference's arrangement, and the thing
 * this app's own first design rule exists to forbid: no cards, structure from rules and
 * space. A stack of twelve identical grey lozenges also reads as twelve unrelated objects
 * rather than as one list.
 */
export function SettingRow({
  icon,
  label,
  value,
  href,
  trailing,
  tone = "normal",
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  href?: string;
  /** Replaces the chevron — used by the visibility row, which carries a switch. */
  trailing?: ReactNode;
  tone?: "normal" | "danger";
}) {
  const body = (
    <>
      <span className={cn("shrink-0", tone === "danger" ? "text-danger" : "text-ash")}>{icon}</span>
      {/* Both label and value stay on one line: a settings row that grows to two lines
          breaks the rhythm of the stack and, at this width, most of them would. */}
      <span
        className={cn(
          "flex-1 truncate text-[15px]",
          tone === "danger" ? "text-danger" : "text-chalk",
        )}
      >
        {label}
      </span>
      {value ? <span className="max-w-[42%] truncate text-[14px] text-dust">{value}</span> : null}
      {trailing ?? (href ? <span className="shrink-0 text-[14px] text-dust">›</span> : null)}
    </>
  );

  const className = cn(
    "flex h-14 w-full items-center gap-3.5 border-b border-hair-bright/60 text-left transition-colors last:border-b-0",
    href && "hover:text-flame",
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
