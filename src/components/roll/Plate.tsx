import { cn } from "@/lib/cn";

import type { Stock } from "@/lib/imagery";

/**
 * One photograph-shaped thing.
 *
 * It draws in two modes, and the difference matters. Given a `photo` it shows that
 * photograph — the covers a host can pick from, and the sample frames the marketing page and
 * the wizard use to demonstrate the reveal. Given only an `index` it draws a wash: a
 * deliberate stand-in for a picture that exists but which nobody is allowed to see yet, which
 * is what the host's own roll grid shows before the reveal. Putting stock photography there
 * would tell a host their guests' pictures had loaded when they had not.
 *
 * Each wash also carries three hard-edged forms. Without them `sealed` was nearly invisible —
 * blurring something already soft changes almost nothing — and the single mechanic the whole
 * product rests on could not be seen. A real photograph needs no such help, so it gets none.
 */
const WASHES = [
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

const TINTS = ["rgba(244,241,236,0.20)", "rgba(0,0,0,0.38)", "rgba(255,140,0,0.16)"];

/** Same index, same forms, every time — a photo does not rearrange itself between screens. */
function forms(index: number) {
  const noise = (n: number) => (((index + 1) * 9301 + n * 49297) % 233280) / 233280;

  return [0, 1, 2].map((n) => ({
    left: `${6 + noise(n * 3) * 58}%`,
    top: `${8 + noise(n * 3 + 1) * 56}%`,
    size: `${20 + noise(n * 3 + 2) * 28}%`,
    radius: n === 1 ? "22%" : "9999px",
    background: TINTS[n],
  }));
}

export function Plate({
  index = 0,
  photo,
  className,
  sealed,
}: {
  /** Picks the wash. Ignored for the fallback layer when `photo` is given. */
  index?: number;
  /** A real photograph. Its own wash paints underneath, so a missing file degrades. */
  photo?: Stock;
  className?: string;
  sealed?: boolean;
}) {
  /*
    When sealed, the blur sits on an oversized inner layer rather than on the plate itself, so
    the haze has material to pull from at the edges instead of fading to the background — a
    plate blurred directly reads as a soft rectangle, not as a photograph you can't see yet.

    Only when sealed. Overscanning a sharp picture just crops it, and at the size of a cover
    thumbnail — 58px wide — a 24px bleed on each side throws away most of the frame.
  */
  const wash = photo ? photo.wash : WASHES[index % WASHES.length];

  return (
    <div className={cn("relative overflow-hidden bg-void", className)} aria-hidden="true">
      <div
        className={cn("absolute bg-cover bg-center", sealed ? "-inset-6" : "inset-0")}
        style={{
          // Two layers. CSS skips a background layer whose URL fails to load, so the wash
          // below it is what shows if the JPEG isn't there.
          backgroundImage: photo ? `url("${photo.src}"), ${wash}` : wash,
          filter: sealed ? "blur(16px) saturate(0.55)" : undefined,
        }}
      >
        {photo
          ? null
          : forms(index).map((form, n) => (
              <span
                key={n}
                className="absolute block aspect-square"
                style={{
                  left: form.left,
                  top: form.top,
                  width: form.size,
                  borderRadius: form.radius,
                  background: form.background,
                }}
              />
            ))}
      </div>
    </div>
  );
}
