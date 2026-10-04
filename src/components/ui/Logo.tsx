import { cn } from "@/lib/cn";

/**
 * The MemoVue mark as paths, so it scales and inherits colour. Four circles on stems converging
 * to one root. Coordinates follow the source artwork; do not round them.
 */

const STEMS = [
  // Far-left circle: shallow away from the circle, steep into the trunk.
  "M58 117 C88 125, 126 168, 134 206",
  // Tallest circle: near-vertical with a slight S.
  "M115 78 C114 110, 124 170, 134 206",
  // Inner-right circle: the shortest fall.
  "M182 92 C170 120, 145 175, 134 206",
  // Far-right circle: the longest, flattest arc.
  "M258 122 C226 130, 150 175, 134 206",
];

const BLOOMS = [
  { cx: 32, cy: 99, r: 32 },
  { cx: 109, cy: 39, r: 39 },
  { cx: 195, cy: 66, r: 29 },
  { cx: 292, cy: 99, r: 41 },
];

export function Mark({ className, glow = false }: { className?: string; glow?: boolean }) {
  return (
    <svg
      viewBox="-4 -4 341 271"
      fill="none"
      className={cn("h-6 w-auto text-flame", className)}
      style={glow ? { filter: "drop-shadow(0 0 18px rgba(255,140,0,0.4))" } : undefined}
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        {STEMS.map((d) => (
          <path key={d} d={d} />
        ))}

        {/* The trunk thickens where the stems merge. */}
        <path d="M134 206 C134 224, 133 246, 133 263" strokeWidth="7.5" />

        {BLOOMS.map((bloom) => (
          <circle key={`${bloom.cx}-${bloom.cy}`} cx={bloom.cx} cy={bloom.cy} r={bloom.r} />
        ))}
      </g>
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
  wordmarkClassName,
  showWordmark = true,
}: {
  className?: string;
  markClassName?: string;
  /** Lets tight headers drop the wordmark at narrow widths and keep just the mark. */
  wordmarkClassName?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mark className={cn("h-5", markClassName)} />
      {showWordmark ? (
        <span
          className={cn("display-sm text-[19px] tracking-[0.01em] text-chalk", wordmarkClassName)}
        >
          MemoVue
        </span>
      ) : null}
    </span>
  );
}
