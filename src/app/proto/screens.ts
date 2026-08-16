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
];

export function screenAt(path: string): Screen | undefined {
  return SCREENS.find((screen) => screen.path === path);
}

export function neighbours(path: string): { prev?: Screen; next?: Screen } {
  const at = SCREENS.findIndex((screen) => screen.path === path);
  if (at === -1) return {};
  return { prev: SCREENS[at - 1], next: SCREENS[at + 1] };
}
