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
  { path: "/proto/join", name: "Join a roll", group: "Entry" },
  { path: "/proto/join?v=invalid", name: "Join a roll — invalid link", group: "Entry" },

  { path: "/proto/home?v=empty", name: "Home — no active rolls", group: "Home" },
  { path: "/proto/home", name: "Home — active roll", group: "Home" },

  { path: "/proto/new/name", name: "New roll 1 — name", group: "Create" },
  { path: "/proto/new/start", name: "New roll 2 — start date", group: "Create" },
  { path: "/proto/new/finish", name: "New roll 3 — finish date", group: "Create" },
  { path: "/proto/new/reveal", name: "New roll 4 — reveal", group: "Create" },
  { path: "/proto/new/card", name: "New roll 5 — invitation card", group: "Create" },
  { path: "/proto/new/card/preview", name: "Invitation card preview", group: "Create" },
  { path: "/proto/new/guests", name: "New roll 6 — guests and shots", group: "Create" },
  { path: "/proto/new/guests?v=coupon", name: "Coupon code dialog", group: "Create" },
  { path: "/proto/new/guests?v=created", name: "Roll created dialog", group: "Create" },

  { path: "/proto/roll", name: "Roll home — before reveal", group: "Roll" },
  { path: "/proto/roll?v=revealed", name: "Roll home — after reveal", group: "Roll" },
  { path: "/proto/roll/people", name: "People sheet", group: "Roll" },
  { path: "/proto/roll/invite", name: "Invite guests", group: "Roll" },
  { path: "/proto/roll/invite?v=saved", name: "QR saved", group: "Roll" },

  { path: "/proto/roll/settings", name: "Roll settings", group: "Settings" },
  { path: "/proto/roll/settings?v=delete", name: "Delete roll dialog", group: "Settings" },
  { path: "/proto/roll/settings/info", name: "Edit roll info", group: "Settings" },
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
