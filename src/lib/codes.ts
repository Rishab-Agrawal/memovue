import { customAlphabet } from "nanoid";

// No O/0/I/1/L — these get read off a printed QR card and typed in by hand.
const UNAMBIGUOUS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const generate = customAlphabet(UNAMBIGUOUS, 6);

/** The code printed on a QR card, which guests scan or type to reach a roll. */
export function rollCode(): string {
  return generate();
}

/** Normalises a typed code so "k7qm-2p" and "K7QM2P" resolve to the same roll. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const CODE_LENGTH = 6;

/**
 * Pulls a roll code out of a scanned QR, a pasted link, or six typed characters. Shared by the
 * scanner and the paste field.
 *
 * **A scanned QR is never navigated to as a URL**: it is untrusted input, so we extract the code
 * and route internally, or the scanner becomes an open redirect. Null for anything else.
 */
export function extractJoinCode(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let candidate = raw;

  if (raw.includes("/")) {
    // Parse rather than split, so a query string like `?utm=x` is dropped.
    let path = raw;
    try {
      path = new URL(raw.includes("://") ? raw : `https://${raw}`).pathname;
    } catch {
      path = raw.split(/[?#]/)[0];
    }

    const segments = path.split("/").filter(Boolean);
    // `/join/<code>` and `/e/<code>` both identify a roll; anything else falls back to the
    // last segment so a shortened or proxied link still works.
    const marked = segments.findIndex((segment) => segment === "join" || segment === "e");
    candidate =
      marked >= 0 && segments[marked + 1] ? segments[marked + 1] : (segments.at(-1) ?? "");
  }

  const code = normalizeCode(candidate);
  if (code.length !== CODE_LENGTH) return null;
  // Outside the printed alphabet, so not a code we issued.
  if (![...code].every((character) => UNAMBIGUOUS.includes(character))) return null;

  return code;
}
