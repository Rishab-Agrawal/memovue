import { readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

/**
 * Turns whatever was dropped into `public/covers` and `public/frames` into something a phone
 * on event wifi will actually load.
 *
 * The art arrives as PNG straight out of an image model — two megabytes each, which is fine
 * for a source file and absurd for nine of them on one marketing page. This re-encodes to
 * JPEG and lowercases the names, the second part mattering more than it looks: we develop on
 * Windows and deploy to Linux, so `Bday-ghibli.png` referenced as `bday-ghibli.png` works
 * locally and 404s only in production.
 *
 * Safe to re-run. Files already converted are skipped.
 *
 * Uses sharp, which is not a dependency we added — Next ships it for its own image
 * optimisation, so it is already sitting in node_modules.
 */

/** Long edge. Covers go full-bleed behind a phone-shaped invitation; nothing needs more. */
const MAX_EDGE = 1440;
const QUALITY = 80;

async function main() {
  for (const dir of ["public/covers", "public/frames"]) {
    for (const file of await readdir(dir)) {
      if (!/\.(png|jpe?g|webp)$/i.test(file)) continue;

      const from = path.join(dir, file);
      const to = path.join(
        dir,
        file.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".jpg",
      );

      if (from === to) continue;

      const before = (await stat(from)).size;
      const buffer = await sharp(from)
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: QUALITY, mozjpeg: true })
        .toBuffer();

      // Through a temp name: sharp cannot read and write the same path, and on a re-run
      // `to` may already exist from a previous pass.
      await sharp(buffer).toFile(`${to}.tmp`);
      await rm(to, { force: true });
      await rename(`${to}.tmp`, to);
      await rm(from);

      const after = buffer.length;
      console.log(
        `${file} -> ${path.basename(to)}  ${(before / 1048576).toFixed(1)}MB -> ` +
          `${Math.round(after / 1024)}KB`,
      );
    }
  }
}

main();
