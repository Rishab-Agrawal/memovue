import { cn } from "@/lib/cn";
import { type EventPhase } from "@/lib/reveal";

const STYLES: Record<EventPhase, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "border-line-bright text-paper-dim" },
  capturing: { label: "Shooting now", className: "border-ember/45 bg-ember/12 text-ember" },
  revealed: { label: "Revealed", className: "border-success/40 bg-success/10 text-success" },
};

export function EventPhaseBadge({ phase, className }: { phase: EventPhase; className?: string }) {
  const style = STYLES[phase];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium",
        style.className,
        className,
      )}
    >
      {phase === "capturing" ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ember" />
        </span>
      ) : null}
      {style.label}
    </span>
  );
}
