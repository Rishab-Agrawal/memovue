import { cn } from "@/lib/cn";
import { type EventPhase } from "@/lib/reveal";

/**
 * A tracked mono label with a status dot rather than a coloured pill — the pill badge is
 * one of the most reproduced components on the web and instantly dates an interface.
 */
const STYLES: Record<EventPhase, { label: string; className: string; dot: string }> = {
  scheduled: { label: "Scheduled", className: "text-dust", dot: "bg-dust" },
  capturing: { label: "Shooting now", className: "text-flame", dot: "bg-flame" },
  revealed: { label: "Revealed", className: "text-success", dot: "bg-success" },
};

export function EventPhaseBadge({ phase, className }: { phase: EventPhase; className?: string }) {
  const style = STYLES[phase];
  return (
    <span className={cn("marking inline-flex items-center gap-2", style.className, className)}>
      <span className="relative flex h-1.5 w-1.5">
        {phase === "capturing" ? (
          <span className="absolute inline-flex h-full w-full animate-ping bg-flame opacity-75" />
        ) : null}
        <span className={cn("relative inline-flex h-1.5 w-1.5", style.dot)} />
      </span>
      {style.label}
    </span>
  );
}
