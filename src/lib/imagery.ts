/**
 * The artwork the app ships with.
 *
 * Two pools, because they do different jobs. `COVERS` are what stands behind a roll's title
 * when the host hasn't uploaded anything of their own — chosen from a picker, so each one
 * needs a name a person would recognise. `FRAMES` are stand-ins for guest photographs on the
 * screens that have to *show* the product before there is a real roll to show: the marketing
 * page, and the wizard steps that demonstrate the reveal.
 *
 * Every entry carries a `wash` as well as a file, and that is not decoration — it is the
 * fallback. Both are handed to CSS as a two-layer `background-image`, and a layer that fails
 * to load is silently skipped, so a missing file shows the gradient underneath it rather than
 * a broken frame. This is also why these are backgrounds rather than static `next/image`
 * imports: a static import of a file that isn't there fails the build, and these assets are
 * regenerated and replaced independently of the code that references them.
 *
 * Source files live in `public/covers` and `public/frames`. Run `npm run images` after adding
 * any — it re-encodes to JPEG and lowercases the names, which matters because we develop on
 * Windows and deploy to Linux.
 */
export interface Stock {
  /** Absolute path under `public/`. */
  src: string;
  /** Painted underneath, and left showing if the file is absent. */
  wash: string;
  /** Human-readable, for the cover picker's accessible names. */
  label: string;
}

/**
 * Order is load-bearing at index 0: `coverPreset` defaults to it in the schema, so it is the
 * cover every roll starts with and the one most hosts will never change. The painted lake
 * leads because it belongs to no particular occasion — a wedding cover on a birthday roll
 * reads as a mistake, this one never does. Weddings follow, being what the product is mostly
 * booked for; the last three are the other occasions it suits.
 *
 * Inserting here renumbers everything after it, so a change to this order needs a migration
 * shifting `Roll.coverPreset` to match — see `20260905193000_default_cover_nature`.
 */
export const COVERS: Stock[] = [
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
    label: "A toast",
  },
  {
    src: "/frames/wedding-walk.jpg",
    wash: "radial-gradient(120% 100% at 35% 75%, #7d4a1a, #1d1409 68%)",
    label: "Walking out",
  },
  {
    src: "/frames/wedding-dance.jpg",
    wash: "radial-gradient(110% 100% at 75% 65%, #45392f, #14100c 72%)",
    label: "The dance floor",
  },
  {
    src: "/frames/birthday-candles.jpg",
    wash: "radial-gradient(110% 100% at 65% 30%, #3b3630, #100f0d 72%)",
    label: "Candles",
  },
];

/** Wraps, so a `coverPreset` from a roll created under a different set still resolves. */
export function cover(index: number): Stock {
  return COVERS[((index % COVERS.length) + COVERS.length) % COVERS.length];
}
