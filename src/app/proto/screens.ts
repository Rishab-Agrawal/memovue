export interface Screen {
  /** Path including any `?v=` variant, exactly as it should be linked. */
  path: string;
  /** Shown in the bottom bar and asserted by the smoke test. */
  name: string;
  group: string;
}

/**
 * Every screen in the prototype, in walking order.
 *
 * The index page, the prev/next bar and the smoke test all read from here, so a screen that
 * is not registered is a screen nobody will review.
 */
export const SCREENS: Screen[] = [
  { path: "/proto/marketing", name: "Marketing home", group: "Marketing" },

  { path: "/proto/welcome", name: "Welcome", group: "Entry" },
  { path: "/proto/join", name: "Join film", group: "Entry" },
  { path: "/proto/join?v=invalid", name: "Join film — invalid link", group: "Entry" },

  { path: "/proto/home?v=empty", name: "Home — no active films", group: "Home" },
  { path: "/proto/home", name: "Home — active film", group: "Home" },

  { path: "/proto/new/name", name: "New film 1 — name", group: "Create" },
  { path: "/proto/new/start", name: "New film 2 — start date", group: "Create" },
  { path: "/proto/new/finish", name: "New film 3 — finish date", group: "Create" },
  { path: "/proto/new/reveal", name: "New film 4 — reveal", group: "Create" },
  { path: "/proto/new/card", name: "New film 5 — invitation card", group: "Create" },
  { path: "/proto/new/card/preview", name: "Invitation card preview", group: "Create" },
  { path: "/proto/new/guests", name: "New film 6 — guests and shots", group: "Create" },
  { path: "/proto/new/guests?v=coupon", name: "Coupon code dialog", group: "Create" },
  { path: "/proto/new/guests?v=created", name: "Film created dialog", group: "Create" },

  { path: "/proto/film", name: "Film home — before reveal", group: "Film" },
  { path: "/proto/film?v=revealed", name: "Film home — after reveal", group: "Film" },
  { path: "/proto/film/people", name: "People sheet", group: "Film" },
  { path: "/proto/film/invite", name: "Invite guests", group: "Film" },
  { path: "/proto/film/invite?v=saved", name: "QR saved", group: "Film" },

  { path: "/proto/film/settings", name: "Film settings", group: "Settings" },
  { path: "/proto/film/settings?v=delete", name: "Delete film dialog", group: "Settings" },
  { path: "/proto/film/settings/info", name: "Edit film info", group: "Settings" },
  { path: "/proto/account", name: "Account settings", group: "Settings" },
  { path: "/proto/account?v=delete", name: "Delete account dialog", group: "Settings" },

  { path: "/proto/guest", name: "Guest invitation", group: "Guest" },
  { path: "/proto/guest/camera", name: "Camera", group: "Guest" },
  { path: "/proto/guest/camera?v=captured", name: "Camera — capture", group: "Guest" },
  { path: "/proto/guest/camera/invite", name: "Camera QR sheet", group: "Guest" },
  { path: "/proto/guest/album", name: "Guest album — before reveal", group: "Guest" },
  {
    path: "/proto/guest/album?v=after-host-only",
    name: "Guest album — revealed, host only",
    group: "Guest",
  },
  {
    path: "/proto/guest/album?v=after-everyone",
    name: "Guest album — revealed, everyone",
    group: "Guest",
  },
  { path: "/proto/guest/album/photo", name: "Photo viewer", group: "Guest" },
];

export function screenAt(path: string): Screen | undefined {
  return SCREENS.find((screen) => screen.path === path);
}

export function neighbours(path: string): { prev?: Screen; next?: Screen } {
  const at = SCREENS.findIndex((screen) => screen.path === path);
  if (at === -1) return {};
  return { prev: SCREENS[at - 1], next: SCREENS[at + 1] };
}
