import { cn } from "@/lib/cn";

/**
 * The MemoVue mark, traced from the source artwork into paths so it scales crisply,
 * inherits colour, and can draw itself in.
 *
 * Four differently-sized circles on curving stems converging to a single root: many
 * viewpoints, one event. The asymmetry is deliberate and load-bearing — evenly spaced
 * identical circles would read as a generic logo grid.
 *
 * Coordinates are in the artwork's own proportions rather than a rounded grid, because
 * regularising them is exactly what would drain the character out of it. Each stem leaves
 * its circle shallow and steepens into the trunk, which is what gives the mark its
 * botanical rather than geometric feel.
 */

const STEMS = [
  // Far-left circle: shallow away from the circle, steep into the trunk.
  { d: "M58 117 C88 125, 126 168, 134 206", length: 118 },
  // Tallest circle: near-vertical with a slight S.
  { d: "M115 78 C114 110, 124 170, 134 206", length: 130 },
  // Inner-right circle: the shortest fall.
  { d: "M182 92 C170 120, 145 175, 134 206", length: 122 },
  // Far-right circle: the longest, flattest arc.
  { d: "M258 122 C226 130, 150 175, 134 206", length: 152 },
];

const BLOOMS = [
  { cx: 32, cy: 99, r: 32 },
  { cx: 109, cy: 39, r: 39 },
  { cx: 195, cy: 66, r: 29 },
  { cx: 292, cy: 99, r: 41 },
];

export function Mark({
  className,
  animate = false,
  glow = false,
}: {
  className?: string;
  /** Draws the stems on, then blooms the circles. Used once, on the landing hero. */
  animate?: boolean;
  glow?: boolean;
}) {
  return (
    <svg
      viewBox="-4 -4 341 271"
      fill="none"
      className={cn("h-6 w-auto text-flame", className)}
      style={glow ? { filter: "drop-shadow(0 0 18px rgba(255,140,0,0.4))" } : undefined}
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        {STEMS.map((stem, index) => (
          <path
            key={stem.d}
            d={stem.d}
            style={
              animate
                ? {
                    // Custom property drives the keyframe, so each stem's dash matches its
                    // own length and they finish together rather than snapping.
                    ["--dash" as string]: stem.length,
                    strokeDasharray: stem.length,
                    animation: `mv-draw 900ms var(--ease-out-soft) ${index * 90}ms both`,
                  }
                : undefined
            }
          />
        ))}

        {/* The trunk thickens where the stems merge. */}
        <path
          d="M134 206 C134 224, 133 246, 133 263"
          strokeWidth="7.5"
          style={
            animate
              ? {
                  ["--dash" as string]: 58,
                  strokeDasharray: 58,
                  animation: "mv-draw 520ms var(--ease-out-soft) 380ms both",
                }
              : undefined
          }
        />

        {BLOOMS.map((bloom, index) => (
          <circle
            key={`${bloom.cx}-${bloom.cy}`}
            cx={bloom.cx}
            cy={bloom.cy}
            r={bloom.r}
            style={
              animate
                ? {
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    animation: `mv-bloom-in 620ms var(--ease-out-soft) ${560 + index * 110}ms both`,
                  }
                : undefined
            }
          />
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
