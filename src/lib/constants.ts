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

  /** Long edge of a roll cover. Smaller than a photo: it sits behind a title, not in an album. */
  coverMaxEdge: 1440,
  coverQuality: 0.82,
  /**
   * What the confirm step will accept for a cover. The client encodes well under this; the
   * ceiling exists because a presigned PUT can't cap what a determined caller uploads.
   */
  coverMaxBytes: 8 * 1024 * 1024,
} as const;
