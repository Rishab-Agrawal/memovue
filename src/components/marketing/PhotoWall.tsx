import { cn } from "@/lib/cn";

/**
 * The hero is the product's core idea rather than a screenshot: the wall of undeveloped
 * photos a guest actually sees before reveal time.
 *
 * Each tile is layered radial gradients — a highlight, a midtone mass, a shadow — because
 * blurring a flat linear gradient just gives you the same flat gradient back. Structure is
 * what makes the blur read as an out-of-focus photograph. Pure CSS, so no assets ship.
 */

interface Tile {
  /** highlight, midtone, shadow, base — roughly how a photo of a lit room decomposes. */
  colors: [string, string, string, string];
}

const TILES: Tile[] = [
  { colors: ["#ffd9a0", "#f2683c", "#5c1c0c", "#1a0d07"] },
  { colors: ["#fff0c4", "#f5a623", "#6b3d06", "#1c1206"] },
  { colors: ["#bfe4f0", "#2f6d84", "#10303d", "#080f14"] },
  { colors: ["#ffc9d8", "#b6456b", "#4a1226", "#170510"] },
  { colors: ["#fff4d6", "#e8c27a", "#7a5620", "#1e150a"] },
  { colors: ["#cdeccb", "#4a7a52", "#1d3a24", "#0a140c"] },
  { colors: ["#ded0ff", "#8a5cc4", "#37205a", "#120b1e"] },
  { colors: ["#ffd2b8", "#f27a5c", "#68251380", "#1a0a06"] },
  { colors: ["#c8d8ff", "#3d5b9e", "#18244a", "#080c17"] },
];

function tileBackground([highlight, mid, shadow, base]: Tile["colors"]): string {
  return [
    `radial-gradient(38% 32% at 32% 24%, ${highlight}, transparent 72%)`,
    `radial-gradient(52% 46% at 68% 58%, ${mid}, transparent 76%)`,
    `radial-gradient(90% 70% at 50% 108%, ${shadow}, transparent 78%)`,
    base,
  ].join(",");
}

export function PhotoWall({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-3 gap-2.5 sm:gap-3", className)} aria-hidden="true">
      {TILES.map((tile, index) => (
        <div
          key={index}
          className="aspect-3/4 overflow-hidden rounded-md ring-1 ring-paper/10"
        >
          <div
            className="h-full w-full animate-develop blur-[14px]"
            style={{
              background: tileBackground(tile.colors),
              // Overscale so the blur's soft edge falls outside the tile instead of
              // vignetting every frame.
              scale: "1.25",
              animationDelay: `${index * 70}ms`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
