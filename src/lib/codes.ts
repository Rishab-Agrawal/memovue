import { customAlphabet } from "nanoid";

// No O/0/I/1/L — these get read off a printed QR card and typed in by hand.
const UNAMBIGUOUS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const generate = customAlphabet(UNAMBIGUOUS, 6);
const generateInvite = customAlphabet(UNAMBIGUOUS, 8);

export function eventCode(): string {
  return generate();
}

export function inviteCode(): string {
  return generateInvite();
}

/** Normalises a typed code so "k7qm-2p" and "K7QM2P" resolve to the same event. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Collapses a display name to a comparison key, so "Riya  Sharma" and "riya sharma"
 * are treated as the same person joining twice.
 */
export function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
