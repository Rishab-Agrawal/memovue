/**
 * The artwork the app ships with. `COVERS` stand behind a roll's title when the host uploaded
 * none; `FRAMES` stand in for guest photos where the product is demonstrated.
 *
 * Each entry's `wash` is painted under the file as a CSS background, so a missing file shows a
 * gradient instead of a broken image (and does not fail the build like a static import would).
 *
 * Run `npm run images` after adding files to `public/covers` or `public/frames`: it re-encodes
 * and lowercases names, which matters when developing on Windows and deploying to Linux.
 */
export interface Stock {
  /** Absolute path under `public/`. */
  src: string;
  /** Painted underneath, and left showing if the file is absent. */
  wash: string;
}

/** A cover carries a label for the picker to announce. */
type Cover = Stock & { label: string };

/**
 * Index 0 is the default `coverPreset`, so it suits any occasion. Rolls store the index, so
 * reordering needs a migration shifting `Roll.coverPreset` — see `20260905193000_default_cover_nature`.
 */
export const COVERS: Cover[] = [
  {
    src: "/covers/nature-ghibli.jpg",
    wash: "radial-gradient(120% 100% at 50% 20%, #2f9ade, #cbb98a 78%)",
    label: "A painted lake",
  },
  {
    src: "/covers/wedding-mandap.jpg",
    wash: "radial-gradient(120% 100% at 30% 25%, #6b3d12, #1a1108 70%)",
    label: "Wedding, the mandap",
  },
  {
    src: "/covers/wedding-morning.jpg",
    wash: "radial-gradient(130% 100% at 25% 55%, #8a5520, #20150a 66%)",
    label: "Wedding, morning",
  },
  {
    src: "/covers/wedding-evening.jpg",
    wash: "radial-gradient(120% 110% at 50% 35%, #5c4326, #16110b 70%)",
    label: "Wedding, evening",
  },
  {
    src: "/covers/wedding-rings.jpg",
    wash: "radial-gradient(120% 100% at 60% 20%, #33302c, #0e0d0c 70%)",
    label: "Wedding, the rings",
  },
  {
    src: "/covers/wedding-western.jpg",
    wash: "radial-gradient(110% 110% at 40% 70%, #7a4a17, #1c1309 68%)",
    label: "Wedding, white",
  },
  {
    src: "/covers/birthday.jpg",
    wash: "radial-gradient(120% 100% at 35% 75%, #7d4a1a, #1d1409 68%)",
    label: "Birthday",
  },
  {
    src: "/covers/trip.jpg",
    wash: "radial-gradient(120% 100% at 70% 40%, #4a3a2e, #120f0c 72%)",
    label: "Trip",
  },
  {
    src: "/covers/celebration.jpg",
    wash: "radial-gradient(110% 100% at 65% 30%, #3b3630, #100f0d 72%)",
    label: "Celebration",
  },
];

export const FRAMES: Stock[] = [
  {
    src: "/frames/wedding-toast.jpg",
    wash: "radial-gradient(120% 110% at 50% 35%, #5c4326, #16110b 70%)",
  },
  {
    src: "/frames/wedding-walk.jpg",
    wash: "radial-gradient(120% 100% at 35% 75%, #7d4a1a, #1d1409 68%)",
  },
  {
    src: "/frames/wedding-dance.jpg",
    wash: "radial-gradient(110% 100% at 75% 65%, #45392f, #14100c 72%)",
  },
  {
    src: "/frames/birthday-candles.jpg",
    wash: "radial-gradient(110% 100% at 65% 30%, #3b3630, #100f0d 72%)",
  },
];

/** Wraps, so a `coverPreset` from a roll created under a different set still resolves. */
export function cover(index: number): Cover {
  return COVERS[((index % COVERS.length) + COVERS.length) % COVERS.length];
}
