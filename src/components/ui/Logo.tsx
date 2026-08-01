import { cn } from "@/lib/cn";

/** Six-blade aperture — the mark for a product about what the lens hasn't shown you yet. */
export function Aperture({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("h-6 w-6", className)} aria-hidden="true">
      <circle cx="12" cy="12" r="10.25" stroke="currentColor" strokeWidth="1.5" />
      <g fill="currentColor" opacity="0.9">
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <path key={angle} d="M12 2.6 L20.1 7.3 L12 12 Z" transform={`rotate(${angle} 12 12)`} />
        ))}
      </g>
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
  showWordmark = true,
}: {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Aperture className={cn("h-6 w-6 text-ember", markClassName)} />
      {showWordmark ? (
        <span className="font-display text-[22px] leading-none text-paper">MemoVue</span>
      ) : null}
    </span>
  );
}
