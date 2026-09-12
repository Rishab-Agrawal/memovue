/**
 * Constants safe to import from client components.
 *
 * Kept apart from `env.ts` on purpose: that module reads secrets at import time and throws
 * if they're missing, which is correct on the server and fatal in a browser bundle.
 */

/**
 * How many times one host may download one roll's ZIP, ever.
 *
 * Here rather than in the route because the Save button has to know it too: the download is a
 * plain anchor, so a browser that follows it past the ceiling renders the refusal as a page.
 * The button answering first is what keeps the host on their album.
 */
export const ZIP_DOWNLOAD_LIMIT = 10;

/** What the host is told once they have spent them. */
export const ZIP_DOWNLOAD_SPENT =
  "You have already downloaded this roll multiple times. In case of any issues, please contact hello@memovue.com";

export const UPLOAD_LIMITS = {
  /**
   * Long edge of the archived original. Keeps most of a 12MP phone's 4:5 crop (~3000×3750),
   * and at 1 byte a pixel — a noisy night shot — still lands under `maxBytes`.
   */
  fullMaxEdge: 3264,
  /** Long edge of the grid image guests actually scroll through after the reveal. */
  previewMaxEdge: 1080,
  fullQuality: 0.9,
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

/** What anyone holding a spent camera is told when the roll has no film left anywhere. */
export const SHOTS_SPENT = "That’s all your shots for this roll.";

/**
 * And what they are told when the pool still has film but they may not draw on it — the first
 * tenth of the event, or a guest who has spent their refills.
 *
 * Two messages rather than one, because the difference matters to the person reading it and
 * the app knows which is true. Telling somebody twenty minutes into a wedding that this is
 * all their shots for the roll is simply false: the pool opens to them shortly. Neither
 * sentence promises anything, because the lifetime ceiling produces this screen too and there
 * is nothing coming after that one.
 */
export const SHOTS_HELD = "That’s all your shots for now.";
