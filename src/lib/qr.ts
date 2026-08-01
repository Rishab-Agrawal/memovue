import QRCode from "qrcode";

import { env } from "./env";

export function joinUrl(code: string): string {
  return `${env.appUrl}/join/${code}`;
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
