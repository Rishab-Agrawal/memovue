import { cn } from "@/lib/cn";

/**
 * Line drawings for the "how it works" steps.
 *
 * Deliberately not an icon set — a row of interchangeable line icons is one of the clearest
 * signals of a generated page. These extend the logo's own grammar (circles on curving
 * stems, converging on a point) so the illustration and the mark read as the same hand, and
 * each one is a different composition rather than three variations on a grid.
 */

export type SketchName = "plan" | "scan" | "album";

function Plan() {
  return (
    <>
      {/* One bloom planted, with the rest still only outlines — the event before anyone joins. */}
      <circle cx="52" cy="34" r="18" />
      <path d="M58 51 C64 68, 70 82, 74 98" />
      <g strokeDasharray="3 6" opacity="0.4">
        <circle cx="98" cy="46" r="14" />
        <path d="M96 60 C90 74, 82 88, 76 98" />
        <circle cx="128" cy="62" r="10" />
        <path d="M124 72 C112 82, 92 92, 78 98" />
      </g>
      <path d="M22 98 H138" opacity="0.3" />
    </>
  );
}

function Scan() {
  return (
    <>
      {/* A code, and the signal leaving it. */}
      <rect x="30" y="30" width="52" height="52" />
      <rect x="38" y="38" width="13" height="13" />
      <rect x="61" y="38" width="13" height="13" />
      <rect x="38" y="61" width="13" height="13" />
      <path d="M61 68 h6 v6" />
      <g opacity="0.75">
        <path d="M96 42 A20 20 0 0 1 96 70" />
        <path d="M108 32 A32 32 0 0 1 108 80" opacity="0.6" />
        <path d="M120 22 A44 44 0 0 1 120 90" opacity="0.35" />
      </g>
    </>
  );
}

function Album() {
  return (
    <>
      {/* Every viewpoint falling into one frame — the mark resolving into the album. */}
      <circle cx="46" cy="30" r="13" />
      <circle cx="76" cy="20" r="16" />
      <circle cx="104" cy="32" r="11" />
      <circle cx="128" cy="44" r="12" />
      <path d="M52 41 C58 52, 70 64, 80 72" />
      <path d="M78 36 C78 48, 79 62, 80 72" />
      <path d="M100 42 C95 52, 86 64, 80 72" />
      <path d="M120 52 C108 60, 90 68, 80 72" />
      <rect x="30" y="72" width="100" height="38" />
    </>
  );
}

const SKETCHES: Record<SketchName, () => React.ReactElement> = {
  plan: Plan,
  scan: Scan,
  album: Album,
};

export function Sketch({ name, className }: { name: SketchName; className?: string }) {
  const Drawing = SKETCHES[name];
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      className={cn("w-full text-flame", className)}
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <Drawing />
      </g>
    </svg>
  );
}
