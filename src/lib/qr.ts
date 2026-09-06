import QRCode from "qrcode";

import { env } from "./env";

export function joinUrl(code: string): string {
  return `${env.appUrl}/join/${code}`;
}

/**
 * A PNG data URL, for the invite sheet's "Save QR".
 *
 * The SVG below is right for the printable card; a phone's save-to-photos wants a raster,
 * and a data URL means the whole thing works from a plain anchor with no download endpoint.
 */
export function qrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 720,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

/**
 * Rendered as inline SVG so the printable card stays crisp at any size and needs no
 * network round trip. Deliberately high error correction — these get printed, taped to
 * tables and scanned across a dim room, so they need to survive smudges and glare.
 */
export function qrSvg(
  code: string,
  { dark = "#0a090b", light = "#f7f2ea" }: { dark?: string; light?: string } = {},
): Promise<string> {
  return QRCode.toString(joinUrl(code), {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 1,
    color: { dark, light },
  });
}
