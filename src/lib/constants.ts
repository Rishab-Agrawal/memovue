/**
 * Constants safe to import from client components.
 *
 * Kept apart from `env.ts` on purpose: that module reads secrets at import time and throws
 * if they're missing, which is correct on the server and fatal in a browser bundle.
 */

export const UPLOAD_LIMITS = {
  /** Long edge of the archived original. */
  fullMaxEdge: 2048,
  /** Long edge of the grid image guests actually scroll through after the reveal. */
  previewMaxEdge: 1080,
  fullQuality: 0.85,
  previewQuality: 0.7,
  /** Hard server-side ceiling per object; the client targets well under this. */
  maxBytes: 12 * 1024 * 1024,
} as const;
