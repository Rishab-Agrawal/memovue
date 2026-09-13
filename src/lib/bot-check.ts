/**
 * Two checks a form asks a script that no person notices — no CAPTCHA on a name typed at a
 * wedding.
 *
 *   1. A field hidden off-screen. Anyone filling it in is not looking at the screen.
 *   2. How long the form was open. A script posts the moment it can.
 *
 * Both are forgeable; they stop generic form-fillers, and the rate limits bound the rest.
 */

/** The floor for a form somebody writes into: faster than reading the first label is not a person. */
export const MIN_FILL_MS = 1_200;

/**
 * The floor at the door of a roll: any measured time at all. The form there can arrive
 * prefilled, so a real guest may tap Join instantly; this only refuses a post that never
 * rendered the form, which reports zero.
 */
export const MIN_RENDER_MS = 1;

export interface BotSignals {
  /** The honeypot's contents. Nobody can see the field, so any value is a script. */
  trap?: string;
  /** How long the form was on screen, as an elapsed span so a wrong device clock cancels out. */
  elapsedMs?: number;
}

export function looksAutomated(
  { trap, elapsedMs }: BotSignals,
  floorMs: number = MIN_FILL_MS,
): boolean {
  if (trap) return true;
  if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs)) return true;
  return elapsedMs < floorMs;
}

/** What a refused form says: no hint which check tripped, and a retry is by definition slower. */
export const AUTOMATED_MESSAGE = "That didn't go through. Please try again.";
