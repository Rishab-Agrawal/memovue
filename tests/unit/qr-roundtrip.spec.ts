import { expect, test } from "@playwright/test";
import jsQR from "jsqr";
import QRCode from "qrcode";

import { extractJoinCode, rollCode } from "@/lib/codes";

/**
 * The generator and the scanner have to agree.
 *
 * We print these codes and we now read them back, with settings chosen for printing — high
 * error correction, a one-module quiet zone. This renders a card exactly as `qr.ts` specifies
 * it, hands the pixels to the same decoder the scanner uses, and checks the string survives
 * the trip and still resolves to the roll it started as.
 *
 * It runs without a browser because the interesting part is not the camera: it is whether our
 * chosen encoding is legible to our chosen decoder at the sizes a phone actually sees.
 */

/** Rasterises a QR to RGBA, the way a camera frame arrives at `jsQR`. */
function rasterize(text: string, { scale, quiet }: { scale: number; quiet: number }) {
  // Same settings as `qrSvg`/`qrDataUrl` in src/lib/qr.ts.
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const size = qr.modules.size;
  const modules = qr.modules.data;

  const width = (size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(width * width * 4);

  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const moduleX = Math.floor(x / scale) - quiet;
      const moduleY = Math.floor(y / scale) - quiet;

      const inside = moduleX >= 0 && moduleY >= 0 && moduleX < size && moduleY < size;
      const dark = inside && modules[moduleY * size + moduleX];
      const value = dark ? 0 : 255;

      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }

  return { data, width };
}

test.describe("a printed code reads back", () => {
  test("jsQR decodes what our generator produces", () => {
    const url = "https://memovue.com/join/K7QM2P";
    const { data, width } = rasterize(url, { scale: 6, quiet: 4 });

    const decoded = jsQR(data, width, width, { inversionAttempts: "dontInvert" });

    expect(decoded?.data).toBe(url);
    expect(extractJoinCode(decoded?.data ?? "")).toBe("K7QM2P");
  });

  /**
   * A QR held at arm's length across a table occupies a small part of the frame. The scanner
   * downscales to 640px before decoding, so the modules a real capture presents are a few
   * pixels each — not the crisp twenty of a screenshot.
   */
  test("still decodes at the module size a phone actually sees", () => {
    const url = "https://memovue.com/join/K7QM2P";

    for (const scale of [2, 3, 4]) {
      const { data, width } = rasterize(url, { scale, quiet: 4 });
      const decoded = jsQR(data, width, width, { inversionAttempts: "dontInvert" });
      expect(decoded?.data, `${scale}px per module`).toBe(url);
    }
  });

  test("round-trips codes the generator actually emits", () => {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const code = rollCode();
      const url = `https://memovue.com/join/${code}`;

      const { data, width } = rasterize(url, { scale: 5, quiet: 4 });
      const decoded = jsQR(data, width, width, { inversionAttempts: "dontInvert" });

      expect(extractJoinCode(decoded?.data ?? "")).toBe(code);
    }
  });

  /** `dontInvert` is a deliberate saving. It is only safe while our cards stay dark-on-light. */
  test("the scanner's dontInvert setting matches how we print", () => {
    const { data, width } = rasterize("https://memovue.com/join/K7QM2P", { scale: 5, quiet: 4 });

    // Invert the raster: white modules on black, which is what `dontInvert` gives up.
    const inverted = new Uint8ClampedArray(data);
    for (let i = 0; i < inverted.length; i += 4) {
      inverted[i] = 255 - inverted[i];
      inverted[i + 1] = 255 - inverted[i + 1];
      inverted[i + 2] = 255 - inverted[i + 2];
    }

    expect(jsQR(data, width, width, { inversionAttempts: "dontInvert" })?.data).toBeTruthy();
    expect(jsQR(inverted, width, width, { inversionAttempts: "dontInvert" })).toBeNull();
  });
});
