/**
 * Two questions every form asks a script and no person ever notices.
 *
 * Neither is a CAPTCHA, and that is the point: the forms here are a name typed at a wedding
 * and a sentence about somebody's event. Putting a puzzle in front of either would cost more
 * real submissions than it saved, so these two cost the person nothing at all.
 *
 *   1. A field hidden off-screen. Anyone filling it in is not looking at the screen.
 *   2. How long the form was open. A script posts the moment it can.
 *
 * Both signals come from the caller and both are forgeable by anyone who reads this file.
 * They are worth having anyway, because the traffic they stop is not written for us — it is
 * a generic form-filler walking every input on a page. Whatever is targeted enough to strip
 * them has already had to get through sign-in or a roll code, and is bounded by the rate
 * limits instead.
 */

/**
 * The floor for a form somebody writes into. Four fields, two of them prose.
 *
 * Low even so. The point is not to measure how long writing takes — it is that a request
 * arriving faster than a person can have read the first label did not come from a person.
 */
export const MIN_FILL_MS = 1_200;

/**
 * The floor at the door of a roll: any measured time at all, and no more than that.
 *
 * Not a speed test, deliberately — it asks whether the form rendered, not whether the guest
 * was quick about it. The form there is one field which arrives prefilled for anybody signed
 * in, so a guest genuinely can tap "Take your camera" the moment the page paints, and turning
 * them away is the worst thing this product can do to somebody. Any threshold above a
 * measurement is a threshold a real hand can fall under.
 *
 * What it still catches is the case actually worth catching, and the one a script produces:
 * a post that never rendered the form at all reports no elapsed time, which arrives as zero
 * and is refused. The honeypot is the stronger of the two signals at this door, and the rate
 * limits are what bound whatever gets past both.
 */
export const MIN_RENDER_MS = 1;

export interface BotSignals {
  /** The honeypot's contents. Nobody can see the field, so any value is a script. */
  trap?: string;
  /**
   * How long the form was on screen, measured by the caller's own clock.
   *
   * An elapsed span rather than the moment it opened, so a phone whose clock is ten minutes
   * out — which `takenAtWithin` exists because they are — cancels its own error out instead
   * of being refused for it.
   */
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

/**
 * What a refused form says. Deliberately says nothing about which check tripped, and asks for
 * a retry rather than declaring a verdict — a person who beat the clock is told to do the one
 * thing that works, since the second attempt is by definition slower than the first.
 */
export const AUTOMATED_MESSAGE = "That didn't go through. Please try again.";
