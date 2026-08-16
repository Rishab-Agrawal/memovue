import { cn } from "@/lib/cn";

/**
 * A gradient standing in for a photograph.
 *
 * The prototype ships no images: the reference app's photos are theirs, and stock imagery
 * would make the screens look more finished than they are. These are the same nine washes
 * the marketing page already uses for its sealed frames, so a "photo" is deterministic by
 * index and looks the same wherever it appears.
 */
const PLATES = [
  "radial-gradient(120% 100% at 30% 25%, #6b3d12, #1a1108 70%)",
  "radial-gradient(120% 100% at 70% 40%, #4a3a2e, #120f0c 72%)",
  "radial-gradient(110% 110% at 40% 70%, #7a4a17, #1c1309 68%)",
  "radial-gradient(120% 100% at 60% 20%, #33302c, #0e0d0c 70%)",
  "radial-gradient(130% 100% at 25% 55%, #8a5520, #20150a 66%)",
  "radial-gradient(110% 100% at 75% 65%, #45392f, #14100c 72%)",
  "radial-gradient(120% 110% at 50% 35%, #5c4326, #16110b 70%)",
  "radial-gradient(120% 100% at 35% 75%, #7d4a1a, #1d1409 68%)",
  "radial-gradient(110% 100% at 65% 30%, #3b3630, #100f0d 72%)",
];

export function Plate({
  index,
  className,
  sealed,
}: {
  index: number;
  className?: string;
  sealed?: boolean;
}) {
  /*
    The blur is on an oversized inner layer rather than the plate itself, so the haze has
    material to pull from at the edges instead of fading to the background — a plate blurred
    directly reads as a soft rectangle, not as a photograph you can't see yet.
  */
  return (
    <div className={cn("relative overflow-hidden bg-void", className)} aria-hidden="true">
      <div
        className="absolute -inset-6"
        style={{
          backgroundImage: PLATES[index % PLATES.length],
          filter: sealed ? "blur(18px) saturate(0.5)" : undefined,
        }}
      />
    </div>
  );
}
