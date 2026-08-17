import { customAlphabet } from "nanoid";

// No O/0/I/1/L — these get read off a printed QR card and typed in by hand.
const UNAMBIGUOUS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const generate = customAlphabet(UNAMBIGUOUS, 6);
const generateInvite = customAlphabet(UNAMBIGUOUS, 8);

/** The code printed on a QR card, which guests scan or type to reach a roll. */
export function rollCode(): string {
  return generate();
}

/** Longer, because a coupon is handed over deliberately rather than read off a table. */
export function inviteCode(): string {
  return generateInvite();
}

/** Normalises a typed code so "k7qm-2p" and "K7QM2P" resolve to the same roll. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const CODE_LENGTH = 6;

/**
 * Pulls a roll code out of whatever a guest arrived with — a scanned QR, a pasted link, or
 * the six characters read off a printed card.
 *
 * The scanner and the paste field share this so they cannot disagree about what counts as an
 * invitation, and so that **a scanned QR is never navigated to as a URL**. A QR code is
 * untrusted input from a sticker anyone can print; we take six characters out of it and route
 * internally to `/join/<code>`. Sending the browser to a scanned address instead would turn
 * the scanner into an open redirect that a stranger controls with a printer.
 *
 * Returns null for anything that isn't a plausible code, which is how the caller tells a
 * MemoVue invitation apart from the wifi QR taped to the same table.
 */
export function extractJoinCode(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let candidate = raw;

  if (raw.includes("/")) {
    // Parse rather than split: `.pop()` on a naive split returns the query string for
    // `…/join/ABC123?utm=x`, which is the sort of link people actually forward.
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
  // Characters outside the printed alphabet can't be a code we issued, so reject here
  // instead of spending a navigation to find that out.
  if (![...code].every((character) => UNAMBIGUOUS.includes(character))) return null;

  return code;
}

/**
 * Collapses a display name to a comparison key, so "Riya  Sharma" and "riya sharma"
 * are treated as the same person joining twice.
 */
export function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
