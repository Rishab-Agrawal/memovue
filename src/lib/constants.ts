/** Constants safe to import from client components. `env.ts` holds the server secrets. */

/**
 * The referral programme, on one switch.
 *
 * A wedding business hands its code to a host; the host types it into the wizard's first step;
 * every guest who opens that roll sees the business named on the roll's home screen. That is the
 * whole deal for now — no discount, nothing spent.
 *
 * `false` takes the field out of the wizard, the card off the roll screen and the section off the
 * admin screen. Rolls already carrying a business keep the column, and the Telegram messages keep
 * naming it, because that is a record of what happened rather than a feature.
 */
export const REFERRALS = true;

/**
 * How many times one host may download one roll's ZIP, ever. Here so the Save button can refuse
 * first, rather than the browser following the anchor onto a plain-text refusal.
 */
export const ZIP_DOWNLOAD_LIMIT = 10;

/** What the host is told once they have spent them. */
export const ZIP_DOWNLOAD_SPENT =
  "You have already downloaded this roll multiple times. In case of any issues, please contact hello@memovue.com";

export const UPLOAD_LIMITS = {
  /** Long edge of the archived original. Keeps most of a 12MP 4:5 crop, still under `maxBytes`. */
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
  /** The largest cover the upload URL will be signed for. */
  coverMaxBytes: 8 * 1024 * 1024,

  /** Long edge of a referral partner's logo. It is drawn in a 48px square and never larger. */
  logoMaxEdge: 320,
  logoQuality: 0.9,
  /** What the admin screen will carry through a server action. A processed logo is ~30KB. */
  logoMaxBytes: 1024 * 1024,
} as const;

/** A spent camera, when the roll has no film left anywhere. */
export const SHOTS_SPENT = "That’s all your shots for this roll.";

/** A spent camera, when the pool has film this guest may not draw yet (or ever again). */
export const SHOTS_HELD = "That’s all your shots for now.";
