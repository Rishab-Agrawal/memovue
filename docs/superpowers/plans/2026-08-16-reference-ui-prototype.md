# Reference-UI Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a clickable, data-free prototype at `/proto` covering all 34 routes of the reworked MemoVue interface, so the flow can be verified before any of it is implemented for real.

**Architecture:** A self-contained route group under `src/app/proto/`. One `screens.ts` registry drives the index page, the prev/next bar, and the smoke test. One `mock.ts` holds every piece of fake data. Pure rules (pricing, date clamping, reveal time, countdown formatting) live in `rules.ts` and are the only thing with real unit tests — the screens themselves are verified by a human walking them, which is the entire point of the deliverable. Nothing outside `src/app/proto/` is touched except two config files, so deleting the prototype is deleting one folder.

**Tech Stack:** Next.js 16.2.12 (App Router), React 19.2.4, Tailwind CSS v4, TypeScript strict, Playwright.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-16-reference-ui-prototype-design.md`. Read it before Task 1.
- **Reference screenshots:** `uiux-reference/*.jpg.jpeg`. Every screen task names the exact file to match. **Open and look at it before writing the screen.**
- **Read the bundled Next docs before writing code.** `node_modules/next/dist/docs/01-app/`. This project's `AGENTS.md` requires it; the App Router here is not necessarily the one you remember.
- **Do not modify `src/app/globals.css`.** Its radius overrides only cover `--radius-xs` … `--radius-xl`; `rounded-2xl` (1rem), `rounded-3xl` (1.5rem) and `rounded-full` resolve to Tailwind defaults and are what the prototype uses.
- **Do not modify anything under `src/app/` outside `src/app/proto/`**, and do not touch `src/components/`, `src/lib/`, or `prisma/`.
- **Colours** come from existing tokens only: `void #000000`, `page #0a0a09`, `surface #131211`, `flame #FF8C00`, `chalk #f4f1ec`, `ash #a8a29a`, `dust #847f76`, `hair #1f1d1b`, `hair-bright #33302c`, `danger #ff6b57`. The reference's accent blue always becomes `flame`.
- **One typeface: Archivo**, already wired as `--font-archivo`. The reference's display serif becomes Archivo at heavy weight. Never introduce a second font.
- **No photographs.** Every image is a CSS gradient plate via the `Plate` component from Task 3.
- **No reference-app branding.** The word "Once", their wordmark, their cover photos and their URLs must appear nowhere. Ours is "MemoVue", `memovue.com`.
- **Shapes are the reference's:** rounded corners, filled `surface` cards, pill buttons. The "no cards, no radius" rules in `WHATS-BUILT.md` do not apply under `/proto`.
- Every screen must render correctly at **390px wide** and must not scroll horizontally.
- `npm run lint` and `npx tsc --noEmit` must pass at the end of every task.

---

### Task 1: Rules and mock data

The pure logic every screen depends on. No UI.

**Files:**
- Create: `src/app/proto/rules.ts`
- Create: `src/app/proto/mock.ts`
- Create: `tests/proto/rules.spec.ts`
- Create: `playwright.proto.config.ts`
- Modify: `playwright.config.ts:10`
- Modify: `package.json:15`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `priceFor(participantIndex: number, shotIndex: number): number` — 0 means free
  - `formatPrice(rupees: number): string` — `"Free"` or `"₹1,299"`
  - `startDateRange(now: Date): { min: Date; max: Date }`
  - `finishDateRange(startAt: Date): { min: Date; max: Date }`
  - `isWithin(day: Date, range: { min: Date; max: Date }): boolean`
  - `revealAt(finishAt: Date, mode: RevealMode, delayHours: number): Date | null`
  - `formatCountdown(msRemaining: number): string`
  - `type RevealMode = "during" | "after" | "delay"`
  - `HOST`, `FILM`, `PHOTOS`, `PEOPLE`, `PRICING`, `COVER_PRESETS`, `COUPON`, `NOW` from `mock.ts`

- [ ] **Step 1: Add the prototype Playwright config**

The existing config needs a live Postgres and runs `npm run start`. The prototype needs neither.

Create `playwright.proto.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

/**
 * The prototype has no database, no auth and no API, so it deliberately does not reuse
 * playwright.config.ts — that one runs a globalSetup which opens a Prisma connection and
 * boots the production server. This one just needs `next dev`.
 */
const BASE_URL = process.env.PROTO_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/proto",
  fullyParallel: true,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: Stop the main suite picking up the prototype tests**

In `playwright.config.ts`, replace line 10:

```ts
  testIgnore: "**/shots.spec.ts",
```

with:

```ts
  // The prototype has its own config (playwright.proto.config.ts) with no database setup.
  testIgnore: ["**/shots.spec.ts", "**/proto/**"],
```

In `package.json`, add a script after `"test:headed"`:

```json
    "test:proto": "playwright test -c playwright.proto.config.ts",
```

- [ ] **Step 3: Write the failing tests**

Create `tests/proto/rules.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

import {
  finishDateRange,
  formatCountdown,
  formatPrice,
  isWithin,
  priceFor,
  revealAt,
  startDateRange,
} from "@/app/proto/rules";

test.describe("pricing", () => {
  test("the smallest tier is free whatever the shot count", () => {
    expect(priceFor(0, 0)).toBe(0);
    expect(priceFor(0, 5)).toBe(0);
    expect(formatPrice(priceFor(0, 5))).toBe("Free");
  });

  test("price rises with participants and with shots", () => {
    expect(priceFor(3, 3)).toBeGreaterThan(priceFor(2, 3));
    expect(priceFor(3, 4)).toBeGreaterThan(priceFor(3, 3));
  });

  test("prices are round rupee figures with a separator", () => {
    expect(priceFor(4, 3) % 10).toBe(0);
    expect(formatPrice(1299)).toBe("₹1,299");
    expect(formatPrice(199)).toBe("₹199");
  });
});

test.describe("date ranges", () => {
  const now = new Date("2026-09-01T10:00:00Z");

  test("a start date may be up to two years out", () => {
    const range = startDateRange(now);
    expect(isWithin(new Date("2028-08-30T10:00:00Z"), range)).toBe(true);
    expect(isWithin(new Date("2028-09-05T10:00:00Z"), range)).toBe(false);
    expect(isWithin(new Date("2026-08-31T10:00:00Z"), range)).toBe(false);
  });

  test("a finish date may be up to two months after the start", () => {
    const range = finishDateRange(new Date("2026-09-12T18:00:00Z"));
    expect(isWithin(new Date("2026-10-30T18:00:00Z"), range)).toBe(true);
    expect(isWithin(new Date("2026-11-20T18:00:00Z"), range)).toBe(false);
    expect(isWithin(new Date("2026-09-11T18:00:00Z"), range)).toBe(false);
  });
});

test.describe("reveal time", () => {
  const finish = new Date("2026-09-13T23:00:00Z");

  test("during-event films never have a reveal moment", () => {
    expect(revealAt(finish, "during", 12)).toBeNull();
  });

  test("after-event films reveal exactly when the film closes", () => {
    expect(revealAt(finish, "after", 12)?.toISOString()).toBe("2026-09-13T23:00:00.000Z");
  });

  test("a delay is counted in hours from the close", () => {
    expect(revealAt(finish, "delay", 12)?.toISOString()).toBe("2026-09-14T11:00:00.000Z");
  });
});

test.describe("countdown", () => {
  const minute = 60_000;

  test("reads in days, then hours, then minutes", () => {
    expect(formatCountdown(3 * 24 * 60 * minute + 4 * 60 * minute)).toBe("3d 4h left");
    expect(formatCountdown(7 * 60 * minute + 32 * minute)).toBe("7h 32m left");
    expect(formatCountdown(50 * minute)).toBe("50m left");
  });

  test("a finished film says so instead of counting backwards", () => {
    expect(formatCountdown(0)).toBe("Ended");
    expect(formatCountdown(-minute)).toBe("Ended");
  });
});
```

- [ ] **Step 4: Run the tests and verify they fail**

Run: `npm run test:proto -- rules`
Expected: FAIL — cannot resolve `@/app/proto/rules`.

- [ ] **Step 5: Write `rules.ts`**

```ts
/**
 * Every rule the prototype's screens depend on, kept apart from the data so a screen can be
 * re-pointed at different mock values without changing behaviour.
 */

export type RevealMode = "during" | "after" | "delay";

/** Participant caps, in the order the eight boxes appear on the guests step. */
export const PARTICIPANT_TIERS = [5, 10, 25, 50, 100, 200, 350, 500] as const;

/** Shots per person, in the order the six chips appear. No infinity option. */
export const SHOT_TIERS = [5, 10, 16, 24, 36, 100] as const;

/**
 * Placeholder rupee pricing. Real numbers are not decided yet, so this is deliberately two
 * small arrays rather than a 48-cell table: fourteen numbers to tune, and every combination
 * still gets its own price. The reference app charged per participant only; ours has to
 * move with shot count too, because shots are what actually cost us storage.
 */
const PARTICIPANT_BASE = [0, 199, 399, 749, 1299, 2299, 3699, 4999];
const SHOT_MULTIPLIER = [0.6, 0.75, 0.9, 1, 1.25, 2];

export function priceFor(participantIndex: number, shotIndex: number): number {
  const base = PARTICIPANT_BASE[participantIndex] ?? 0;
  if (base === 0) return 0;
  const multiplier = SHOT_MULTIPLIER[shotIndex] ?? 1;
  return Math.round((base * multiplier) / 10) * 10;
}

export function formatPrice(rupees: number): string {
  if (rupees === 0) return "Free";
  return `₹${rupees.toLocaleString("en-IN")}`;
}

export interface DateRange {
  min: Date;
  max: Date;
}

/** Weddings get booked years ahead, so the window is generous. Settings can still move it. */
export function startDateRange(now: Date): DateRange {
  const max = new Date(now);
  max.setFullYear(max.getFullYear() + 2);
  return { min: startOfDay(now), max: startOfDay(max) };
}

/** A film that runs longer than two months is a mistake, not a plan. */
export function finishDateRange(startAt: Date): DateRange {
  const max = new Date(startAt);
  max.setMonth(max.getMonth() + 2);
  return { min: startOfDay(startAt), max: startOfDay(max) };
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function isWithin(day: Date, range: DateRange): boolean {
  const at = startOfDay(day).getTime();
  return at >= startOfDay(range.min).getTime() && at <= startOfDay(range.max).getTime();
}

/** `during` films have no reveal moment — the photos were never sealed. */
export function revealAt(finishAt: Date, mode: RevealMode, delayHours: number): Date | null {
  if (mode === "during") return null;
  if (mode === "after") return new Date(finishAt);
  return new Date(finishAt.getTime() + delayHours * 3_600_000);
}

export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return "Ended";

  const minutes = Math.floor(msRemaining / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) return `${days}d ${hours % 24}h left`;
  if (hours >= 1) return `${hours}h ${minutes % 60}m left`;
  return `${minutes}m left`;
}
```

- [ ] **Step 6: Run the tests and verify they pass**

Run: `npm run test:proto -- rules`
Expected: PASS, 9 tests.

- [ ] **Step 7: Write `mock.ts`**

```ts
import { PARTICIPANT_TIERS, SHOT_TIERS, type RevealMode } from "./rules";

/**
 * Every piece of fake data the prototype shows. One file on purpose: changing a name, a
 * count or a date is a one-line edit here rather than a hunt through screens.
 *
 * Times are fixed rather than relative to the real clock so the prototype renders the same
 * countdown on every run and screenshots stay comparable.
 */

export const NOW = new Date("2026-09-12T22:10:00+05:30");

export const HOST = { name: "Rishab Agrawal", initials: "RA", firstName: "Rishab" };

export const FILM = {
  title: "Aarav & Diya's Wedding",
  code: "K7M2XQP9",
  joinUrl: "https://memovue.com/f/K7M2XQP9",
  startAt: new Date("2026-09-12T18:00:00+05:30"),
  finishAt: new Date("2026-09-13T23:00:00+05:30"),
  revealMode: "after" as RevealMode,
  revealDelayHours: 12,
  participantIndex: 3, // 50
  shotIndex: 3, // 24
  everyoneCanSee: false,
  moments: 2,
  people: 2,
  keptUntil: new Date("2026-10-13T23:00:00+05:30"),
};

export const PARTICIPANT_CAP = PARTICIPANT_TIERS[FILM.participantIndex];
export const SHOTS_PER_PERSON = SHOT_TIERS[FILM.shotIndex];

/** Newest first, which is the order the album renders in. */
export const PHOTOS = [
  { id: "p4", by: "Meera", takenAt: new Date("2026-09-12T21:58:00+05:30"), plate: 3 },
  { id: "p3", by: "You", takenAt: new Date("2026-09-12T21:31:00+05:30"), plate: 1 },
  { id: "p2", by: "You", takenAt: new Date("2026-09-12T20:14:00+05:30"), plate: 4 },
  { id: "p1", by: "Meera", takenAt: new Date("2026-09-12T19:02:00+05:30"), plate: 2 },
];

export const PEOPLE = [
  { name: "You", shotsUsed: 2 },
  { name: "Meera", shotsUsed: 2 },
];

/** Indices into the Plate component's gradient set. */
export const COVER_PRESETS = [0, 1, 2, 3, 4];

/** The one code that works in the prototype. Everything else is rejected. */
export const COUPON = "MEMOVUE100";

/** The finished album shown under ALBUMS on the home screen. */
export const PAST_ALBUM = {
  title: "Diwali at Meera's",
  from: new Date("2026-08-08T19:00:00+05:30"),
  to: new Date("2026-08-09T02:00:00+05:30"),
  plates: [0, 2, 4, 1],
};
```

- [ ] **Step 8: Verify it typechecks and lints**

Run: `npx tsc --noEmit`
Expected: no output.
Run: `npm run lint`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add playwright.proto.config.ts playwright.config.ts package.json src/app/proto tests/proto
git commit -m "Add prototype rules, mock data and its own test config"
```

---

### Task 2: Shell — registry, phone frame, screen bar, index

The scaffolding that makes 34 screens walkable. After this task `/proto` lists everything and the two screens that exist are reachable.

**Files:**
- Create: `src/app/proto/screens.ts`
- Create: `src/app/proto/components/PhoneFrame.tsx`
- Create: `src/app/proto/components/ScreenBar.tsx`
- Create: `src/app/proto/layout.tsx`
- Create: `src/app/proto/page.tsx`
- Create: `tests/proto/walk.spec.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `interface Screen { path: string; name: string; group: string }`
  - `SCREENS: Screen[]` — every route, in walking order, variants included
  - `<PhoneFrame>{children}</PhoneFrame>`
  - `<ScreenBar />` — reads `usePathname()` + `useSearchParams()`, renders prev/next
  - The layout renders `PhoneFrame` around `children` and pins `ScreenBar` to the bottom.

- [ ] **Step 1: Write the registry**

Create `src/app/proto/screens.ts`. Every later task appends its routes here; the index page, the prev/next bar and the smoke test all read from it, so a screen that is not registered is a screen nobody will review.

```ts
export interface Screen {
  /** Path including any `?v=` variant, exactly as it should be linked. */
  path: string;
  /** Shown in the bottom bar and asserted by the smoke test. */
  name: string;
  group: string;
}

export const SCREENS: Screen[] = [
  { path: "/proto/marketing", name: "Marketing home", group: "Marketing" },
];

export function screenAt(path: string): Screen | undefined {
  return SCREENS.find((screen) => screen.path === path);
}

export function neighbours(path: string): { prev?: Screen; next?: Screen } {
  const at = SCREENS.findIndex((screen) => screen.path === path);
  if (at === -1) return {};
  return { prev: SCREENS[at - 1], next: SCREENS[at + 1] };
}
```

- [ ] **Step 2: Write the phone frame**

Create `src/app/proto/components/PhoneFrame.tsx`. On a wide viewport it draws a 390×844 device so the screens read like the reference screenshots; on a real phone it gets out of the way entirely.

```tsx
import type { ReactNode } from "react";

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-void md:items-center md:py-10">
      <div
        className={
          "relative flex w-full flex-col overflow-hidden bg-page " +
          "md:h-[844px] md:w-[390px] md:rounded-[2.5rem] md:border md:border-hair-bright md:shadow-[0_0_80px_-20px_rgba(255,140,0,0.25)]"
        }
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the screen bar**

Create `src/app/proto/components/ScreenBar.tsx`. It is the only chrome the prototype adds and it must never be mistaken for product UI, so it sits on `void` behind a hairline.

```tsx
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { neighbours, screenAt } from "../screens";

export function ScreenBar() {
  const pathname = usePathname();
  const variant = useSearchParams().get("v");
  const path = variant ? `${pathname}?v=${variant}` : pathname;

  const current = screenAt(path);
  const { prev, next } = neighbours(path);

  return (
    <nav className="flex shrink-0 items-center justify-between gap-3 border-t border-hair-bright bg-void px-3 py-2 text-[12px]">
      {prev ? (
        <Link href={prev.path} className="tap text-dust hover:text-flame">
          ‹ prev
        </Link>
      ) : (
        <span className="text-hair-bright">‹ prev</span>
      )}

      <Link
        href="/proto"
        data-testid="screen-name"
        className="truncate text-center text-ash hover:text-flame"
      >
        {current?.name ?? "unregistered"}
      </Link>

      {next ? (
        <Link href={next.path} className="tap text-dust hover:text-flame">
          next ›
        </Link>
      ) : (
        <span className="text-hair-bright">next ›</span>
      )}
    </nav>
  );
}
```

- [ ] **Step 4: Write the layout**

Create `src/app/proto/layout.tsx`. `ScreenBar` calls `useSearchParams`, which needs a Suspense boundary above it.

```tsx
import { Suspense, type ReactNode } from "react";

import { PhoneFrame } from "./components/PhoneFrame";
import { ScreenBar } from "./components/ScreenBar";

export const metadata = { title: "Prototype", robots: { index: false, follow: false } };

export default function ProtoLayout({ children }: { children: ReactNode }) {
  return (
    <PhoneFrame>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <Suspense fallback={<div className="h-9 shrink-0 border-t border-hair-bright bg-void" />}>
        <ScreenBar />
      </Suspense>
    </PhoneFrame>
  );
}
```

- [ ] **Step 5: Write the index page**

Create `src/app/proto/page.tsx`. Groups in registry order, every route linked including variants.

```tsx
import Link from "next/link";

import { SCREENS } from "./screens";

export default function ProtoIndex() {
  const groups = SCREENS.reduce<Record<string, typeof SCREENS>>((acc, screen) => {
    (acc[screen.group] ??= []).push(screen);
    return acc;
  }, {});

  return (
    <div className="px-5 py-8">
      <h1 className="display text-[28px]">Screens</h1>
      <p className="mt-2 text-[14px] text-ash">
        {SCREENS.length} routes. Nothing here talks to a server.
      </p>

      <div className="mt-8 space-y-7">
        {Object.entries(groups).map(([group, screens]) => (
          <section key={group}>
            <h2 className="marking">{group}</h2>
            <ul className="mt-2 divide-y divide-hair">
              {screens.map((screen) => (
                <li key={screen.path}>
                  <Link
                    href={screen.path}
                    className="flex items-center justify-between py-3 text-[15px] text-chalk hover:text-flame"
                  >
                    {screen.name}
                    <span className="text-[12px] text-dust">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write the smoke test**

Create `tests/proto/walk.spec.ts`. It iterates the registry, so every screen added by a later task is automatically covered.

```ts
import { expect, test } from "@playwright/test";

import { SCREENS } from "@/app/proto/screens";

test("the index links every registered screen", async ({ page }) => {
  await page.goto("/proto");
  for (const screen of SCREENS) {
    await expect(page.getByRole("link", { name: screen.name, exact: true })).toBeVisible();
  }
});

for (const screen of SCREENS) {
  test(`${screen.name} renders`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(screen.path);
    expect(response?.status()).toBe(200);

    await expect(page.getByTestId("screen-name")).toHaveText(screen.name);

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
    expect(errors).toEqual([]);
  });
}
```

- [ ] **Step 7: Create the marketing screen so the registry is not empty**

Copy `src/app/page.tsx` to `src/app/proto/marketing/page.tsx` verbatim, then make exactly three edits and one addition:

1. Header CTA: the `ButtonLink` reading "Sign in" becomes `Get started` with `href="/proto/welcome"`.
2. Hero: the two `ButtonLink`s ("Create an event" and "I have a code") collapse to one `ButtonLink` reading `Get started`, `href="/proto/welcome"`, keeping the first button's `variant` and `size`.
3. Closing section: the `ButtonLink` reading "Create an event" becomes `Get started` with `href="/proto/welcome"`.
4. Rename the default export from `Home` to `MarketingHome`.

Leave every other line — copy, layout, the sealed-frame gradients — untouched. This is the live page with its calls to action unified, not a redesign.

- [ ] **Step 8: Run the smoke test**

Run: `npm run test:proto -- walk`
Expected: PASS, 2 tests.

- [ ] **Step 9: Verify and commit**

Run: `npx tsc --noEmit` then `npm run lint`. Both clean.

```bash
git add src/app/proto tests/proto
git commit -m "Add prototype shell: registry, phone frame, screen bar and index"
```

---

### Task 3: UI kit and entry screens

**Screenshots to match:** `Welcome-sign-up-screen.jpg.jpeg`, `Join-film.jpg.jpeg`, `Join-film-invalid.jpg.jpeg`.

**Files:**
- Create: `src/app/proto/components/Plate.tsx`
- Create: `src/app/proto/components/Dialog.tsx`
- Create: `src/app/proto/components/Sheet.tsx`
- Create: `src/app/proto/components/Chrome.tsx`
- Create: `src/app/proto/welcome/page.tsx`
- Create: `src/app/proto/join/page.tsx`
- Modify: `src/app/proto/screens.ts`
- Create: `tests/proto/entry.spec.ts`

**Interfaces:**
- Produces:
  - `<Plate index={number} className={string} />` — a deterministic gradient standing in for a photograph
  - `<Dialog open title body actions />` — centred modal on a `surface` card, `rounded-3xl`
  - `<Sheet title children />` — bottom sheet with a drag handle, `rounded-t-3xl`
  - `<BackButton href />`, `<PagerDots count current />`, `<PillButton />` from `Chrome.tsx`

- [ ] **Step 1: Write `Plate.tsx`**

Nine gradients, reused everywhere a photograph would be. Deterministic by index so the same "photo" looks the same on every screen.

```tsx
const PLATES = [
  "radial-gradient(120% 100% at 30% 25%, #6b3d12, #1a1108 70%)",
  "radial-gradient(120% 100% at 70% 40%, #4a3a2e, #120f0c 72%)",
  "radial-gradient(110% 110% at 40% 70%, #7a4a17, #1c1309 68%)",
  "radial-gradient(120% 100% at 60% 20%, #33302c, #0e0d0c 70%)",
  "radial-gradient(130% 100% at 25% 55%, #8a5520, #20150a 66%)",
  "radial-gradient(110% 100% at 75% 65%, #45392f, #14100c 72%)",
  "radial-gradient(120% 110% at 50% 35%, #5c4326, #16110b 70%)",
  "radial-gradient(120% 100% at 35% 75%, #7d4a1a, #1d1409 68%)",
  "radial-gradient(110% 100% at 65% 30%, #3b3630, #100f0d 72%)",
];

export function Plate({
  index,
  className,
  sealed,
}: {
  index: number;
  className?: string;
  sealed?: boolean;
}) {
  return (
    <div
      className={className}
      style={{
        backgroundImage: PLATES[index % PLATES.length],
        filter: sealed ? "blur(18px) saturate(0.5)" : undefined,
      }}
    />
  );
}
```

Note `sealed` — the pre-reveal album and the reveal step both need the blurred version.

- [ ] **Step 2: Write `Dialog.tsx` and `Sheet.tsx`**

`Dialog`: fixed inset, `bg-void/70 backdrop-blur-sm` scrim, centred `bg-surface rounded-3xl p-6` panel, max width 320px, title in `display-sm text-[19px]`, body in `text-[14px] text-ash`, actions as a row of full-width pill buttons.

`Sheet`: fixed bottom, `bg-surface rounded-t-3xl`, a 40×4 `bg-hair-bright rounded-full` drag handle centred at the top with 12px padding, title in `display-md text-[24px]`, content below. Uses the existing `animate-sheet-in` class from `globals.css`.

Both take `open: boolean` and render `null` when closed.

- [ ] **Step 3: Write `Chrome.tsx`**

- `BackButton` — 48×48 `bg-surface rounded-2xl` with a `←` glyph, top-left, matching every reference screen's back affordance.
- `PagerDots` — a row of 6px dots, `bg-chalk` for the current one and `bg-hair-bright` otherwise, centred.
- `PillButton` — `rounded-full h-12 px-6 text-[15px] font-medium`, variants `light` (bg-chalk text-void, the reference's white primary), `flame` (bg-flame text-void), `quiet` (bg-surface text-chalk).

- [ ] **Step 4: Build the welcome screen**

`src/app/proto/welcome/page.tsx`. Match `Welcome-sign-up-screen.jpg.jpeg`, minus Apple.

- Vertically centred: the MemoVue mark above the words `Welcome to MemoVue`, `display` at 34px.
- Pushed to the bottom: one `PillButton variant="light"` full width reading `Google` with a `G` glyph, then below it a `PillButton variant="quiet"` full width reading `Invited? Join film here` with a QR glyph, linking to `/proto/join`.
- Footer, `text-[13px] text-dust` centred: `By signing up, you agree to MemoVue's Terms of Service and Privacy Policy.` with the two document names underlined.

The reference puts Apple and Google side by side; with one provider the button goes full width.

- [ ] **Step 5: Build the join screen**

`src/app/proto/join/page.tsx`, a client component. Match `Join-film.jpg.jpeg`.

- Top two-thirds: a `Plate index={5}` standing in for the camera feed, with a `BackButton` overlaid top-left and a centred 320×320 dashed `border-2 border-dashed border-flame/70 rounded-3xl` scan window.
- Below, on `page`: label `OR PASTE INVITATION LINK` using `.marking`, an input with placeholder `Paste link` on `bg-surface rounded-2xl h-14 px-4`, and a full-width `PillButton variant="light"` reading `Join →`.
- Reading `?v=invalid` opens the `Dialog`: title `Invalid link`, body `Please scan a QR code or paste a valid invitation link.`, one action `OK` that links back to `/proto/join`. Match `Join-film-invalid.jpg.jpeg`.

- [ ] **Step 6: Register the screens**

Append to `SCREENS` in registry order:

```ts
  { path: "/proto/welcome", name: "Welcome", group: "Entry" },
  { path: "/proto/join", name: "Join film", group: "Entry" },
  { path: "/proto/join?v=invalid", name: "Join film — invalid link", group: "Entry" },
```

- [ ] **Step 7: Write the entry test**

Create `tests/proto/entry.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("welcome offers Google and the guest route, and nothing else", async ({ page }) => {
  await page.goto("/proto/welcome");

  await expect(page.getByText("Welcome to MemoVue")).toBeVisible();
  await expect(page.getByRole("link", { name: /Invited\? Join film here/ })).toBeVisible();
  await expect(page.getByText("Google")).toBeVisible();
  await expect(page.getByText("Apple")).toHaveCount(0);
});

test("the invalid-link dialog is reachable and dismissible", async ({ page }) => {
  await page.goto("/proto/join?v=invalid");

  await expect(page.getByText("Invalid link")).toBeVisible();
  await page.getByRole("link", { name: "OK" }).click();
  await expect(page.getByText("Invalid link")).toHaveCount(0);
  await expect(page.getByPlaceholder("Paste link")).toBeVisible();
});
```

- [ ] **Step 8: Run tests, verify, commit**

Run: `npm run test:proto`
Expected: PASS — walk grows to 5 screens, entry adds 2.
Run `npx tsc --noEmit` and `npm run lint`, both clean.

```bash
git add src/app/proto tests/proto
git commit -m "Add prototype UI kit and entry screens"
```

---

### Task 4: Host home

**Screenshots to match:** `Home-screen.jpg.jpeg`, `Home-screen-no-active-films.jpg.jpeg`.

**Files:**
- Create: `src/app/proto/components/BottomNav.tsx`
- Create: `src/app/proto/home/page.tsx`
- Modify: `src/app/proto/screens.ts`
- Create: `tests/proto/home.spec.ts`

**Interfaces:**
- Consumes: `Plate`, `PillButton` (Task 3); `FILM`, `PAST_ALBUM`, `NOW` (Task 1); `formatCountdown` (Task 1).
- Produces: `<BottomNav current="films" | "account" />`

- [ ] **Step 1: Write `BottomNav.tsx`**

Two items only — the reference's TAPES tab is removed. `FILMS` on the left with a film-canister glyph, linking to `/proto/home`; an account circle on the right linking to `/proto/account`. Fixed to the bottom of the screen area, `bg-page/95 backdrop-blur border-t border-hair`, 56px tall. Current item is `text-chalk`, the other `text-dust`.

- [ ] **Step 2: Build the home screen**

`src/app/proto/home/page.tsx`, a client component reading `?v=`.

Header row: the MemoVue wordmark left; on the right a `quiet` pill reading `Join` with a QR glyph linking to `/proto/join`, then a `light` pill reading `+ New` linking to `/proto/new/name`.

`ACTIVE` section, `.marking`:
- Default variant: one film card — `Plate index={0}` at `rounded-3xl` roughly 200×260, with `FILM.title` overlaid at the top in `display-md text-[22px]` (clamped to two lines), the countdown from `formatCountdown(FILM.finishAt - NOW)` beneath it with a clock glyph, and a centred 72×56 `bg-void/70 rounded-2xl` camera button. Tapping the card goes to `/proto/film`.
- `?v=empty`: a 28px `bg-hair-bright rounded-full` dot, the words `No active films` in `text-dust`, and a `flame` pill reading `+ Create film` linking to `/proto/new/name`. Everything centred in the section.

`ALBUMS` section, below a hairline: one row for `PAST_ALBUM` — title in `display-md text-[22px]` on the left, the date range `Aug 8–9, 2026` in `text-[13px] text-dust` on the right, then a horizontal strip of four `Plate`s at `rounded-2xl`, slightly overlapped and each rotated a degree or two, matching the fanned look in the screenshot. Tapping it goes to `/proto/guest/album?v=after-everyone`.

`BottomNav current="films"` pinned at the bottom.

- [ ] **Step 3: Register**

```ts
  { path: "/proto/home?v=empty", name: "Home — no active films", group: "Home" },
  { path: "/proto/home", name: "Home — active film", group: "Home" },
```

- [ ] **Step 4: Write the test**

```ts
import { expect, test } from "@playwright/test";

test("the empty home offers the only two ways forward", async ({ page }) => {
  await page.goto("/proto/home?v=empty");

  await expect(page.getByText("No active films")).toBeVisible();
  await expect(page.getByRole("link", { name: /Create film/ })).toHaveAttribute(
    "href",
    "/proto/new/name",
  );
  await expect(page.getByText("TAPES")).toHaveCount(0);
});

test("an active film shows its countdown and opens the film", async ({ page }) => {
  await page.goto("/proto/home");

  await expect(page.getByText("Aarav & Diya's Wedding")).toBeVisible();
  await expect(page.getByText(/left$/)).toBeVisible();
  await page.getByText("Aarav & Diya's Wedding").click();
  await expect(page).toHaveURL(/\/proto\/film/);
});
```

The second test's navigation will fail until Task 8 creates `/proto/film`. Register `/proto/film` as a stub page in this task — a single `<div>` — so the link resolves; Task 8 replaces it.

- [ ] **Step 5: Run tests, verify, commit**

```bash
git add src/app/proto tests/proto
git commit -m "Add prototype host home"
```

---

### Task 5: Wizard steps 1–3 — name, start, finish

**Screenshots to match:** `Event-name.jpg.jpeg` (minus the SUGGESTIONS block), `Event-start-date.jpg.jpeg` (minus Skip), `Event-finish-date.jpg.jpeg`, `Event-finish-time.jpg.jpeg`.

**Files:**
- Create: `src/app/proto/components/Calendar.tsx`
- Create: `src/app/proto/components/TimeWheel.tsx`
- Create: `src/app/proto/components/WizardShell.tsx`
- Create: `src/app/proto/new/name/page.tsx`
- Create: `src/app/proto/new/start/page.tsx`
- Create: `src/app/proto/new/finish/page.tsx`
- Modify: `src/app/proto/screens.ts`
- Create: `tests/proto/wizard-dates.spec.ts`

**Interfaces:**
- Consumes: `startDateRange`, `finishDateRange`, `isWithin`, `NOW`, `FILM` (Task 1); `BackButton`, `PagerDots`, `PillButton` (Task 3).
- Produces:
  - `<WizardShell step={1..6} title subtitle back next>{children}</WizardShell>`
  - `<Calendar value onChange range />` — month grid, days outside `range` rendered `text-hair-bright` and non-interactive
  - `<TimeWheel open value onDone onCancel />` — hour and minute columns, Cancel and Done

- [ ] **Step 1: Write `WizardShell.tsx`**

Every wizard step shares the same frame, so it is written once: `BackButton` top-left, a centred `display` title at 30px with `text-balance`, a centred `text-[15px] text-ash` subtitle, the step's own content, then a footer holding `PagerDots count={6}` centred and the next control right-aligned. `next` is a `{ label: string; href: string; disabled?: boolean }`.

- [ ] **Step 2: Write `Calendar.tsx`**

A month grid: `‹ Month YYYY ›` header, `Sun`…`Sat` column labels in `.marking` at 11px, six rows of days. Days in the adjacent months and days outside `range` render `text-hair-bright` with `pointer-events-none`. The selected day gets a `border border-flame text-flame rounded-2xl` treatment — the reference uses a rounded-square outline, not a filled circle. Arrows do not navigate past the range.

- [ ] **Step 3: Write `TimeWheel.tsx`**

Match `Event-finish-time.jpg.jpeg`: a `Dialog`-scrim overlay holding two scrolling columns (hours 00–23, minutes 00–59) with the centred row highlighted by a `bg-hair rounded-2xl` band, and `Cancel` / `Done` pills below. Selection is by click in the prototype; real scroll-snap is not required.

- [ ] **Step 4: Build step 1 — name**

Title `What is the name of your event?`, subtitle `Choose the perfect title for your film. This title will be visible to all of your film guests.` One input on `bg-surface rounded-2xl h-16 px-4` with a pencil glyph, defaulted to `FILM.title`. **No SUGGESTIONS block.** Next → `/proto/new/start`, disabled when the field is empty.

- [ ] **Step 5: Build step 2 — start**

Title `When does your event start?`, subtitle `Guests can start capturing photos from this moment.` `Calendar` with `range={startDateRange(NOW)}`, then a hairline and a `TIME` row whose right side is a `bg-surface rounded-2xl` button opening the `TimeWheel`. **No Skip button** — the footer holds only the dots and `Next →` to `/proto/new/finish`.

- [ ] **Step 6: Build step 3 — finish**

Title `When does your event finish?`, subtitle `Guests can capture photos until the film closes at your chosen time.` Identical structure to step 2 but `range={finishDateRange(FILM.startAt)}`. Next → `/proto/new/reveal`.

The reference's copy here reads "The film opens now…"; ours cannot, because the film now has a start.

- [ ] **Step 7: Register**

```ts
  { path: "/proto/new/name", name: "New film 1 — name", group: "Create" },
  { path: "/proto/new/start", name: "New film 2 — start date", group: "Create" },
  { path: "/proto/new/finish", name: "New film 3 — finish date", group: "Create" },
```

- [ ] **Step 8: Write the test**

```ts
import { expect, test } from "@playwright/test";

test("the name step drops the reference's suggestions", async ({ page }) => {
  await page.goto("/proto/new/name");

  await expect(page.getByText("What is the name of your event?")).toBeVisible();
  await expect(page.getByText("SUGGESTIONS")).toHaveCount(0);
});

test("the start step has no skip, and refuses dates beyond two years", async ({ page }) => {
  await page.goto("/proto/new/start");

  await expect(page.getByRole("button", { name: "Skip" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Next/ })).toBeVisible();

  // September 2026 + 2 years = September 2028; the month after is entirely out of range.
  await page.getByLabel("Next month").click({ clickCount: 25 });
  await expect(page.getByRole("button", { name: "15", exact: true })).toHaveCount(0);
});

test("the finish step is clamped to two months after the start", async ({ page }) => {
  await page.goto("/proto/new/finish");

  await expect(page.getByText("When does your event finish?")).toBeVisible();
  await page.getByLabel("Next month").click({ clickCount: 3 });
  await expect(page.getByRole("button", { name: "15", exact: true })).toHaveCount(0);
});
```

Give the calendar arrows `aria-label="Next month"` and `aria-label="Previous month"`, and render selectable days as `<button>` and unselectable ones as `<span>`, which is what makes these assertions meaningful.

- [ ] **Step 9: Run tests, verify, commit**

```bash
git add src/app/proto tests/proto
git commit -m "Add prototype wizard steps 1-3"
```

---

### Task 6: Wizard steps 4–5 — reveal and invitation card

**Screenshots to match:** `Reveal-during-event.jpg.jpeg`, `Reveal-after-event.jpg.jpeg`, `Reveal-additional-delay.jpg.jpeg`, `Invitation-card-design.jpg.jpeg`, `Invitation-card-preview.jpg.jpeg`.

**Files:**
- Create: `src/app/proto/new/reveal/page.tsx`
- Create: `src/app/proto/new/card/page.tsx`
- Create: `src/app/proto/new/card/preview/page.tsx`
- Modify: `src/app/proto/screens.ts`
- Create: `tests/proto/wizard-reveal.spec.ts`

**Interfaces:**
- Consumes: `WizardShell`, `Calendar`-free; `Plate` with `sealed`; `revealAt`, `RevealMode`, `FILM`, `HOST`, `SHOTS_PER_PERSON`, `formatCountdown`.

- [ ] **Step 1: Build step 4 — reveal**

Title `When should we reveal your photos?`, subtitle `Photos are hidden by default during the event. You can select when the photos will be revealed.`

Two `Plate`s side by side at `rounded-3xl`, roughly 300px tall, each with a credit name top-left in italic `text-[14px] text-chalk/80`.

Below them, three equal option tiles on `bg-surface rounded-2xl p-4`, each an hourglass glyph over a two-line label: `During Event`, `After Event`, `Additional Delay`. The selected one gets `border border-flame text-flame`.

Behaviour, which is the whole point of the screen:
- `During Event` — plates render sharp, no overlay.
- `After Event` — plates render `sealed`, with a centred `bg-void/70 rounded-full px-4 py-2` chip reading `Reveals on {date} at {time}` computed by `revealAt(FILM.finishAt, "after", 0)`.
- `Additional Delay` — same as above but the chip uses `revealAt(FILM.finishAt, "delay", hours)`, and a `− 12 +` stepper appears beneath the tiles on a hairline-separated row. Range 1–72 hours.

Next → `/proto/new/card`.

- [ ] **Step 2: Build step 5 — invitation card**

Title `Design your film invitation card.`, subtitle `This cover is the first thing guests see when they are invited to your film.`

Centre: a phone mock — a `rounded-[2rem] border-4 border-hair-bright` frame about 210×420 containing a miniature of the guest landing screen (cover plate, `Invited by {HOST.firstName}` chip, the film title, the countdown and shot count, a name field, and a `Take your camera →` pill). It is a static miniature, not an iframe.

Below, on a hairline: two `quiet` pills side by side, `Edit Cover Image` and `Preview`. `Preview` links to `/proto/new/card/preview`.

Next → `/proto/new/guests`.

- [ ] **Step 3: Build the preview**

`/proto/new/card/preview` is the full-screen version of that miniature, matching `Invitation-card-preview.jpg.jpeg`: full-bleed `Plate index={0}`, a bottom gradient scrim, `Invited by {HOST.name}` chip, the title in `display` at 30px centred, a row reading `{countdown} · {SHOTS_PER_PERSON} shots available`, a disabled field showing `Preview User`, and a full-width `light` pill `Take your camera →`. A close `✕` top-right returns to `/proto/new/card`.

- [ ] **Step 4: Register**

```ts
  { path: "/proto/new/reveal", name: "New film 4 — reveal", group: "Create" },
  { path: "/proto/new/card", name: "New film 5 — invitation card", group: "Create" },
  { path: "/proto/new/card/preview", name: "Invitation card preview", group: "Create" },
```

- [ ] **Step 5: Write the test**

```ts
import { expect, test } from "@playwright/test";

test("reveal mode changes what the sample photos show", async ({ page }) => {
  await page.goto("/proto/new/reveal");

  await page.getByRole("button", { name: /During Event/ }).click();
  await expect(page.getByText(/Reveals on/)).toHaveCount(0);

  await page.getByRole("button", { name: /After Event/ }).click();
  await expect(page.getByText(/Reveals on/)).toBeVisible();
  const atClose = await page.getByText(/Reveals on/).textContent();

  await page.getByRole("button", { name: /Additional Delay/ }).click();
  await expect(page.getByText(/Reveals on/)).not.toHaveText(atClose ?? "");
});

test("the delay stepper moves the reveal time and is bounded", async ({ page }) => {
  await page.goto("/proto/new/reveal");
  await page.getByRole("button", { name: /Additional Delay/ }).click();

  await expect(page.getByTestId("delay-hours")).toHaveText("12");
  await page.getByRole("button", { name: "Increase delay" }).click();
  await expect(page.getByTestId("delay-hours")).toHaveText("13");

  await page.getByRole("button", { name: "Decrease delay" }).click({ clickCount: 20 });
  await expect(page.getByTestId("delay-hours")).toHaveText("1");
});
```

- [ ] **Step 6: Run tests, verify, commit**

```bash
git add src/app/proto tests/proto
git commit -m "Add prototype wizard steps 4-5"
```

---

### Task 7: Wizard step 6 — guests, shots, coupon, creation

The commercial screen. **Screenshots to match:** `Guests-and-shots-number.jpg.jpeg`, `Guests-and-shots-number-visibility-toggle.jpg.jpeg`, `Film-created-msg.jpg.jpeg`.

**Files:**
- Create: `src/app/proto/components/Counter.tsx`
- Create: `src/app/proto/components/Toggle.tsx`
- Create: `src/app/proto/new/guests/page.tsx`
- Modify: `src/app/proto/screens.ts`
- Create: `tests/proto/wizard-guests.spec.ts`

**Interfaces:**
- Consumes: `PARTICIPANT_TIERS`, `SHOT_TIERS`, `priceFor`, `formatPrice`, `COUPON`, `FILM`, `Dialog`, `WizardShell`, `Plate`.
- Produces: `<Counter value />` (the mechanical dial), `<Toggle on onChange labelOn labelOff />`

- [ ] **Step 1: Write `Counter.tsx`**

The film-counter dial from the reference: a `bg-void rounded-2xl` pill about 96×56 showing three numbers — `value-1` and `value+1` clipped at the edges in `text-dust` at 60% scale, `value` centred in italic `text-chalk` at 22px. `overflow-hidden`, `.tabular` so it does not jitter.

- [ ] **Step 2: Write `Toggle.tsx`**

A 60×34 `rounded-full` track, `bg-flame` when on and `bg-hair-bright` when off, with a 26px `bg-chalk rounded-full` knob that slides. The label sits to the right and swaps text with the state.

- [ ] **Step 3: Build the guests step**

`Up to {PARTICIPANT_TIERS[i]} Participants` in `display-md text-[26px]` on the left, `formatPrice(priceFor(i, s))` on the right in `text-[15px] text-dust`.

Below it, eight equal `rounded-2xl` boxes about 48px tall. Boxes up to and including the selected index get `border border-flame bg-flame/10`; the selected one also shows a person glyph. Clicking box *n* selects tier *n*.

Hairline. `SHOTS PER PERSON` in `.marking`. Then the reference's shutter row — a wide `border border-hair-bright rounded-b-[3rem]` arc holding the `Counter` on the left, a 76px `bg-chalk rounded-full` disc in the centre, and two overlapping `Plate`s on the right. Then six chips `5 / 10 / 16 / 24 / 36 / 100`; selected gets `border border-flame text-flame`. **There is no infinity option.**

Hairline. `VISIBILITY PERMISSIONS` in `.marking`, then the `Toggle`: on reads `Everyone can see all photos.`, off reads `Only host can see all photos.`

Footer: dots plus a `light` pill reading `Create →` which opens the coupon dialog rather than navigating.

- [ ] **Step 4: Build the coupon and created dialogs**

Coupon `Dialog`, opened by Create and also by `?v=coupon`:
- Title `Enter your coupon code`
- Body `MemoVue is invite-only while we're in beta. Enter the code you were given to create this film.`
- An input on `bg-void rounded-2xl h-14 px-4`, `autoCapitalize="characters"`
- Actions: `Cancel` (quiet) and `Apply` (flame, disabled while empty)
- A wrong code shows `That code isn't valid or has already been used.` in `text-danger text-[13px]` under the field and does not close.
- `COUPON` closes it and opens the created dialog.

Created `Dialog`, also reachable at `?v=created`, matching `Film-created-msg.jpg.jpeg`:
- Title `Film Created!`
- Body: `Your film "{FILM.title}" is ready!`, then a blank line, then `Share Code: {FILM.code}`, then a blank line, then `Guests can join at:` and `{FILM.joinUrl}`
- One action `OK` linking to `/proto/film`

- [ ] **Step 5: Register**

```ts
  { path: "/proto/new/guests", name: "New film 6 — guests and shots", group: "Create" },
  { path: "/proto/new/guests?v=coupon", name: "Coupon code dialog", group: "Create" },
  { path: "/proto/new/guests?v=created", name: "Film created dialog", group: "Create" },
```

- [ ] **Step 6: Write the test**

```ts
import { expect, test } from "@playwright/test";

test("the smallest tier is free and price moves with both dials", async ({ page }) => {
  await page.goto("/proto/new/guests");

  await page.getByRole("button", { name: "Up to 5 participants" }).click();
  await expect(page.getByTestId("price")).toHaveText("Free");

  await page.getByRole("button", { name: "Up to 100 participants" }).click();
  const at24 = await page.getByTestId("price").textContent();

  await page.getByRole("button", { name: "36", exact: true }).click();
  await expect(page.getByTestId("price")).not.toHaveText(at24 ?? "");
});

test("there is no unlimited shots option", async ({ page }) => {
  await page.goto("/proto/new/guests");

  await expect(page.getByRole("button", { name: "100", exact: true })).toBeVisible();
  await expect(page.getByText("∞")).toHaveCount(0);
});

test("the visibility toggle states who can see what", async ({ page }) => {
  await page.goto("/proto/new/guests");

  const toggle = page.getByRole("switch");
  await expect(page.getByText("Only host can see all photos.")).toBeVisible();
  await toggle.click();
  await expect(page.getByText("Everyone can see all photos.")).toBeVisible();
});

test("creating demands a valid coupon", async ({ page }) => {
  await page.goto("/proto/new/guests");
  await page.getByRole("button", { name: /Create/ }).click();

  await expect(page.getByText("Enter your coupon code")).toBeVisible();

  await page.getByRole("textbox").fill("NOPE");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText(/isn't valid or has already been used/)).toBeVisible();

  await page.getByRole("textbox").fill("MEMOVUE100");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Film Created!")).toBeVisible();
  await expect(page.getByText("K7M2XQP9")).toBeVisible();
});
```

Give the participant boxes `aria-label={`Up to ${cap} participants`}`, the price element `data-testid="price"`, and the toggle `role="switch"`.

- [ ] **Step 7: Run tests, verify, commit**

```bash
git add src/app/proto tests/proto
git commit -m "Add prototype wizard step 6 with coupon gate"
```

---

### Task 8: Film home, people and invite

**Screenshots to match:** `Film-home-screen.jpg.jpeg`, `Qr-invite-from-film-home.jpg.jpeg`, `Save-qr.jpg.jpeg`, and `After-reveal-guest-view-host-only.jpg.jpeg` for the revealed header.

**Files:**
- Create: `src/app/proto/components/FilmHeader.tsx`
- Replace: `src/app/proto/film/page.tsx` (the Task 4 stub)
- Create: `src/app/proto/film/invite/page.tsx`
- Create: `src/app/proto/film/people/page.tsx`
- Create: `src/app/proto/components/QrPlate.tsx`
- Modify: `src/app/proto/screens.ts`
- Create: `tests/proto/film.spec.ts`

**Interfaces:**
- Produces:
  - `<FilmHeader revealed={boolean} />` — cover, back, gear, title, the three stats
  - `<QrPlate />` — a fake QR: a 21×21 CSS grid of black and white cells from a fixed seed, on a white `rounded-2xl` panel. Never generate a real scannable code in the prototype.

- [ ] **Step 1: Write `FilmHeader.tsx`**

Full-bleed `Plate index={0}` about 300px tall with a bottom scrim. `BackButton` top-left linking to `/proto/home`; a 48×48 `bg-surface/70 rounded-2xl` gear top-right linking to `/proto/film/settings`. The title centred in `display-md text-[26px]`. Beneath it a three-column row, each column a value in italic `display-md text-[20px]` over a `text-[13px] text-dust` label:
- `{FILM.moments}` / `Moments`
- `{countdown}` / `Left` — when `revealed`, this becomes the finish date over the word `Ended`
- `{FILM.people}` / `People ›`, the whole column linking to `/proto/film/people`

- [ ] **Step 2: Build the film home**

Below the header, a row of controls:
- Not revealed: a wide `light` pill with a camera glyph (about 70% width) linking to `/proto/guest/camera`, then a 56px `quiet` square with a QR glyph linking to `/proto/film/invite`, then a 56px `quiet` square with a download glyph, `aria-disabled` and `text-dust`.
- Revealed (`?v=revealed`): two equal `quiet` pills, `Send` and `Save`.

Then the visibility notice — a full-width `bg-surface rounded-2xl h-14` row, centred, lock glyph plus `Only the host can see everyone's photos` in `text-[14px] text-dust`.

Then the photo grid: two columns, 12px gap, `rounded-2xl` tiles from `PHOTOS`.
- Not revealed: each tile is a `Plate sealed`, with a centred `bg-void/60 rounded-full px-3 py-1.5` chip reading `Reveals in {countdown}` and the credit bottom-left in italic.
- Revealed: sharp plates, credit bottom-left, tapping opens `/proto/guest/album/photo`.

Under the grid, `text-[12px] text-dust` centred: `Photos available until 13 Oct`.

- [ ] **Step 3: Build the invite sheet**

`/proto/film/invite` renders the film home behind a `Sheet`, matching `Qr-invite-from-film-home.jpg.jpeg`:
- Title `Invite guests to your film.`
- Body `Take a glimpse of your world through their lens. Invite your guests to make this film unforgettable.`
- A hairline, then a centred `QrPlate`
- Two `quiet` pills side by side: `Share Link` and `Save QR image`. The second links to `?v=saved`.
- `?v=saved` layers a `Dialog`: title `Success`, body `QR code saved to your photos!`, action `OK`.

- [ ] **Step 4: Build the people sheet**

`/proto/film/people` renders the film home behind a `Sheet` titled `People`, with a subtitle `{FILM.people} of {PARTICIPANT_CAP} participants have joined.` and a `divide-y divide-hair` list of `PEOPLE`: the name on the left in `text-[15px]`, `{shotsUsed} of {SHOTS_PER_PERSON} shots used` on the right in `text-[13px] text-dust`.

This screen has no reference screenshot — it replaces the reference's Add Participants sheet, which we do not want.

- [ ] **Step 5: Register**

```ts
  { path: "/proto/film", name: "Film home — before reveal", group: "Film" },
  { path: "/proto/film?v=revealed", name: "Film home — after reveal", group: "Film" },
  { path: "/proto/film/people", name: "People sheet", group: "Film" },
  { path: "/proto/film/invite", name: "Invite guests", group: "Film" },
  { path: "/proto/film/invite?v=saved", name: "QR saved", group: "Film" },
```

- [ ] **Step 6: Write the test**

```ts
import { expect, test } from "@playwright/test";

test("before the reveal nothing is downloadable and every tile is sealed", async ({ page }) => {
  await page.goto("/proto/film");

  await expect(page.getByText("Only the host can see everyone's photos")).toBeVisible();
  await expect(page.getByLabel("Download album")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText(/Reveals in/).first()).toBeVisible();
  await expect(page.getByText("Photos available until 13 Oct")).toBeVisible();
});

test("after the reveal the camera gives way to Send and Save", async ({ page }) => {
  await page.goto("/proto/film?v=revealed");

  await expect(page.getByRole("link", { name: "Send" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Save" })).toBeVisible();
  await expect(page.getByText("Ended")).toBeVisible();
  await expect(page.getByText(/Reveals in/)).toHaveCount(0);
});

test("People opens a roster rather than an upsell", async ({ page }) => {
  await page.goto("/proto/film");
  await page.getByRole("link", { name: /People/ }).click();

  await expect(page.getByText("Meera")).toBeVisible();
  await expect(page.getByText(/shots used/).first()).toBeVisible();
  await expect(page.getByText(/Add Participants/i)).toHaveCount(0);
});

test("the QR sheet can be saved", async ({ page }) => {
  await page.goto("/proto/film/invite");

  await expect(page.getByText("Invite guests to your film.")).toBeVisible();
  await page.getByRole("link", { name: "Save QR image" }).click();
  await expect(page.getByText("QR code saved to your photos!")).toBeVisible();
});
```

- [ ] **Step 7: Run tests, verify, commit**

```bash
git add src/app/proto tests/proto
git commit -m "Add prototype film home, people and invite"
```

---

### Task 9: Settings — film and account

**Screenshots to match:** `Settings-menu.jpg.jpeg`, `Film-settings-toggle-visibility.jpg.jpeg`, `Edit-film-info.jpg.jpeg`, `Account-settings.jpg.jpeg`, `Delete-account.jpg.jpeg`.

**Files:**
- Create: `src/app/proto/components/SettingRow.tsx`
- Create: `src/app/proto/film/settings/page.tsx`
- Create: `src/app/proto/film/settings/info/page.tsx`
- Create: `src/app/proto/account/page.tsx`
- Modify: `src/app/proto/screens.ts`
- Create: `tests/proto/settings.spec.ts`

**Interfaces:**
- Produces: `<SettingRow icon label value href />` — the `bg-surface rounded-2xl h-16` row with a chevron, used by both settings screens.

- [ ] **Step 1: Build the film settings sheet**

`/proto/film/settings` renders the film home behind a `Sheet` titled `Film Settings`. Rows, in this order:

| Icon | Label | Value | Goes to |
|---|---|---|---|
| pencil | `Name & Cover` | `FILM.title`, truncated | `/proto/film/settings/info` |
| calendar | `Start date` | `Sep 12, 2026 at 6:00 PM` | `/proto/new/start` |
| calendar | `Ending date` | `Sep 13, 2026 at 11:00 PM` | `/proto/new/finish` |
| clock | `Reveal time` | `After` | `/proto/new/reveal` |

Then the visibility row — same shape but with a `Toggle` on the right instead of a chevron, label `Everyone can see all photos`, lock glyph flipping between closed and open with the state.

**No `Participants` row and no `Shots per person` row.** Both exist in the reference and we do not want them.

Finally a full-width `Delete` in `text-danger` on `bg-danger/8 rounded-2xl`, opening `?v=delete`: a `Dialog` with title `Delete this film?`, body `Every photo in it will be permanently deleted and cannot be recovered.`, actions `Cancel` and `Delete` (danger).

- [ ] **Step 2: Build edit film info**

`/proto/film/settings/info`, matching `Edit-film-info.jpg.jpeg`. `BackButton`, title `Edit your film info`, subtitle `Update your film's title and cover image.` Then:
- `FILM TITLE` in `.marking`, an input on `bg-surface rounded-2xl h-16` with a pencil glyph
- a hairline
- `COVER IMAGE` in `.marking`, a 120×220 `Plate rounded-2xl` on the left with a `quiet` pill `Change Cover` beside it
- `Or choose a preset:` in `text-[14px] text-ash`, then a row of five `Plate`s from `COVER_PRESETS` at about 74×140, `rounded-xl`, the selected one ringed in flame
- a full-width `light` pill `Save` pinned at the bottom

- [ ] **Step 3: Build account settings**

`/proto/account`, matching `Account-settings.jpg.jpeg` minus two things.

- Title `Settings` in `display` at 30px
- `INFO`: a 64px `bg-chalk text-void rounded-full` circle holding `HOST.initials`, beside a `bg-surface rounded-2xl h-16` row showing `HOST.name` with a pencil glyph on the right
- `SOCIALS`: **one** full-width `Instagram` row — the reference pairs it with `Website`, which we drop because we are the website — then a full-width `Contact Support` row with an envelope glyph
- **No `PARTNER` section.** The reference's `Have a discount code?` row is removed; coupons are entered at creation instead.
- `ACCOUNT`: `Logout` and `Delete Account`, both `text-danger` on `bg-surface rounded-2xl`
- `BottomNav current="account"`

`?v=delete` opens the dialog from `Delete-account.jpg.jpeg`: a `text-danger` warning triangle, title `Delete Account?`, the line `This will permanently delete:` and three bullets —
`Your account and profile`,
`All films you created will be permanently deleted and cannot be recovered`,
`Your participation in other events will no longer be attached to your account`
— then in `text-danger` centred: `Hosted events and account data cannot be recovered after deletion.` Actions `Cancel` and `Delete Account` (danger). **The reference's tapes bullet is removed.**

- [ ] **Step 4: Register**

```ts
  { path: "/proto/film/settings", name: "Film settings", group: "Settings" },
  { path: "/proto/film/settings?v=delete", name: "Delete film dialog", group: "Settings" },
  { path: "/proto/film/settings/info", name: "Edit film info", group: "Settings" },
  { path: "/proto/account", name: "Account settings", group: "Settings" },
  { path: "/proto/account?v=delete", name: "Delete account dialog", group: "Settings" },
```

- [ ] **Step 5: Write the test**

```ts
import { expect, test } from "@playwright/test";

test("film settings drops participants and shots, and keeps the dates", async ({ page }) => {
  await page.goto("/proto/film/settings");

  await expect(page.getByText("Name & Cover")).toBeVisible();
  await expect(page.getByText("Start date")).toBeVisible();
  await expect(page.getByText("Ending date")).toBeVisible();
  await expect(page.getByText("Reveal time")).toBeVisible();

  await expect(page.getByText("Participants")).toHaveCount(0);
  await expect(page.getByText("Shots per person")).toHaveCount(0);
});

test("account settings drops Website and the discount section", async ({ page }) => {
  await page.goto("/proto/account");

  await expect(page.getByText("Instagram")).toBeVisible();
  await expect(page.getByText("Contact Support")).toBeVisible();

  await expect(page.getByText("Website")).toHaveCount(0);
  await expect(page.getByText("PARTNER")).toHaveCount(0);
  await expect(page.getByText(/discount code/i)).toHaveCount(0);
});

test("the delete-account dialog no longer mentions tapes", async ({ page }) => {
  await page.goto("/proto/account?v=delete");

  await expect(page.getByText("Delete Account?")).toBeVisible();
  await expect(page.getByText(/participation in other events/)).toBeVisible();
  await expect(page.getByText(/tapes/i)).toHaveCount(0);
});
```

- [ ] **Step 6: Run tests, verify, commit**

```bash
git add src/app/proto tests/proto
git commit -m "Add prototype film and account settings"
```

---

### Task 10: Guest landing and camera

**Screenshots to match:** `Invitation-card-actual.jpg.jpeg`, `Camera-screen.jpg.jpeg`, `Qr-invite-from-camera-screen.jpg.jpeg`.

**Files:**
- Create: `src/app/proto/guest/page.tsx`
- Create: `src/app/proto/guest/camera/page.tsx`
- Create: `src/app/proto/guest/camera/invite/page.tsx`
- Modify: `src/app/proto/screens.ts`
- Create: `tests/proto/guest-camera.spec.ts`

- [ ] **Step 1: Build the guest landing**

`/proto/guest`, matching `Invitation-card-actual.jpg.jpeg`. Full-bleed `Plate index={0}` with a bottom scrim. Centred low on the cover: a `bg-void/40 backdrop-blur rounded-full px-4 py-2` chip reading `Invited by {HOST.firstName}` with a person glyph; the film title in `display` at 30px, centred, two lines; a row reading `{countdown} · {SHOTS_PER_PERSON} shots available` with clock and camera glyphs. Below the cover: an input on `bg-surface rounded-2xl h-16` with placeholder `Enter your name` and a pencil glyph, then a full-width `light` pill `Take your camera →` linking to `/proto/guest/camera`, disabled while the name is empty.

- [ ] **Step 2: Build the camera**

`/proto/guest/camera`, matching `Camera-screen.jpg.jpeg`. This is the screen the whole product turns on, so match the geometry closely.

- Header: `BackButton` left; centred, the film title in `display-sm text-[19px]` over `{countdown}` in `text-[13px] text-dust`; a 56px `bg-surface rounded-2xl` QR button right, linking to `/proto/guest/camera/invite`.
- Viewfinder: a `Plate index={6} rounded-[2rem]` filling the width at roughly 4:5.
- Controls row: a flash-off glyph left, a `bg-void rounded-full` segmented `1x | 2x` control centred with the active segment on `bg-surface`, a flip-camera glyph right.
- Bottom row, three columns: the `Counter` **bottom-left**, an 88px shutter — `border-4 border-chalk rounded-full` around a `bg-surface` disc — centred, and a 72px `bg-surface rounded-2xl` gallery thumbnail **bottom-right** holding a small `Plate`, linking to `/proto/guest/album`.

- [ ] **Step 3: Build the capture animation**

Tapping the shutter, and also loading `?v=captured`:
1. A white flash across the viewfinder for 90ms — reuse the existing `mv-shutter` keyframe from `globals.css`.
2. The captured frame holds for ~600ms.
3. It then scales to 0.12 and translates to the gallery thumbnail's centre over 420ms on `--ease-out-soft`, fading out at the end.
4. The `Counter` decrements when the animation finishes.

There is **no keep/retake step** — the reference has none and neither do we.

Implement with a single absolutely-positioned copy of the viewfinder plate and a CSS transition on `transform`/`opacity`; do not add an animation library. Respect `prefers-reduced-motion` by skipping steps 2–3 and decrementing immediately.

- [ ] **Step 4: Build the camera QR sheet**

`/proto/guest/camera/invite`, matching `Qr-invite-from-camera-screen.jpg.jpeg`: the camera screen behind a `Sheet` carrying the same title, body, `QrPlate`, `Share Link` and `Save QR image` as the host's invite sheet. Guests can invite guests.

- [ ] **Step 5: Register**

```ts
  { path: "/proto/guest", name: "Guest invitation", group: "Guest" },
  { path: "/proto/guest/camera", name: "Camera", group: "Guest" },
  { path: "/proto/guest/camera?v=captured", name: "Camera — capture", group: "Guest" },
  { path: "/proto/guest/camera/invite", name: "Camera QR sheet", group: "Guest" },
```

- [ ] **Step 6: Write the test**

```ts
import { expect, test } from "@playwright/test";

test("the invitation needs a name before handing over a camera", async ({ page }) => {
  await page.goto("/proto/guest");

  await expect(page.getByText(/Invited by Rishab/)).toBeVisible();
  await expect(page.getByText(/24 shots available/)).toBeVisible();

  const go = page.getByRole("link", { name: /Take your camera/ });
  await expect(go).toHaveAttribute("aria-disabled", "true");

  await page.getByPlaceholder("Enter your name").fill("Meera");
  await expect(go).not.toHaveAttribute("aria-disabled", "true");
});

test("the shutter spends a shot with no confirmation step", async ({ page }) => {
  await page.goto("/proto/guest/camera");

  await expect(page.getByTestId("shots-left")).toHaveText("24");
  await page.getByRole("button", { name: "Take photo" }).click();

  await expect(page.getByText(/Keep it/i)).toHaveCount(0);
  await expect(page.getByText(/Retake/i)).toHaveCount(0);
  await expect(page.getByTestId("shots-left")).toHaveText("23");
});

test("the gallery thumbnail opens the album", async ({ page }) => {
  await page.goto("/proto/guest/camera");
  await page.getByRole("link", { name: "Open album" }).click();
  await expect(page).toHaveURL(/\/proto\/guest\/album/);
});
```

- [ ] **Step 7: Run tests, verify, commit**

```bash
git add src/app/proto tests/proto
git commit -m "Add prototype guest landing and camera"
```

---

### Task 11: Guest album and photo viewer

**Screenshots to match:** `Before-reveal-guest-view-host-only.jpg.jpeg`, `After-reveal-guest-view-host-only.jpg.jpeg`, `After-reveal-guest-view-all.jpg.jpeg`, `Full-screen-photo-viewing.jpg.jpeg`.

**Files:**
- Create: `src/app/proto/guest/album/page.tsx`
- Create: `src/app/proto/guest/album/photo/page.tsx`
- Modify: `src/app/proto/screens.ts`
- Create: `tests/proto/guest-album.spec.ts`

- [ ] **Step 1: Build the album**

`/proto/guest/album` reuses `FilmHeader` and the control row from Task 8, then adds the guest-only banner and switches its grid on `?v=`.

The banner, straight from the reference and deliberately kept: a full-width `rounded-2xl` panel in a warm sand `bg-[#f2e4bd] text-void`, holding `Sign up to keep your memories alive.` in `font-semibold text-[16px]`, `You are currently on guest mode. Create an account to keep your memories safe.` in `text-[14px] text-void/70`, and a `→` on the right. It links to `/proto/welcome`. This is the one place the prototype uses a colour outside the palette; it is load-bearing, because the banner has to interrupt.

Variants:
- default (before reveal): the lock notice, then sealed tiles each with a `Reveals in {countdown}` chip and the credit `You` bottom-left in italic.
- `?v=after-host-only`: header shows `Sep 13` over `Ended`; the control row is `Send` / `Save`; the lock notice stays; only the two photos whose `by` is `You` are shown, sharp.
- `?v=after-everyone`: no lock notice; all four `PHOTOS` shown sharp, each credited with its `by` name.

Below the grid, the retention line: `Photos available until 13 Oct`.

- [ ] **Step 2: Build the photo viewer**

`/proto/guest/album/photo`, matching `Full-screen-photo-viewing.jpg.jpeg` with the two changes you asked for.

- On `void`. Top-left: the credit in italic `display-md text-[22px]` over `Sep 12, 9:31pm` in `text-[14px] text-dust`. Top-right: a 56px `bg-surface rounded-2xl` `✕` returning to `/proto/guest/album?v=after-everyone`.
- The photo centred, full width, at its natural aspect.
- At the bottom: **one** `quiet` pill reading `Save` with a download glyph, **centred**. The reference's share and `⋯` buttons are dropped.

- [ ] **Step 3: Register**

```ts
  { path: "/proto/guest/album", name: "Guest album — before reveal", group: "Guest" },
  { path: "/proto/guest/album?v=after-host-only", name: "Guest album — revealed, host only", group: "Guest" },
  { path: "/proto/guest/album?v=after-everyone", name: "Guest album — revealed, everyone", group: "Guest" },
  { path: "/proto/guest/album/photo", name: "Photo viewer", group: "Guest" },
];
```

- [ ] **Step 4: Write the test**

```ts
import { expect, test } from "@playwright/test";

test("before the reveal a guest sees only sealed frames", async ({ page }) => {
  await page.goto("/proto/guest/album");

  await expect(page.getByText("Sign up to keep your memories alive.")).toBeVisible();
  await expect(page.getByText("Only the host can see everyone's photos")).toBeVisible();
  await expect(page.getByText(/Reveals in/).first()).toBeVisible();
});

test("host-only visibility shows the guest their own photos and no one else's", async ({
  page,
}) => {
  await page.goto("/proto/guest/album?v=after-host-only");

  await expect(page.getByText("You").first()).toBeVisible();
  await expect(page.getByText("Meera")).toHaveCount(0);
  await expect(page.getByText("Only the host can see everyone's photos")).toBeVisible();
});

test("open visibility credits every photographer", async ({ page }) => {
  await page.goto("/proto/guest/album?v=after-everyone");

  await expect(page.getByText("Meera").first()).toBeVisible();
  await expect(page.getByText("You").first()).toBeVisible();
  await expect(page.getByText("Only the host can see everyone's photos")).toHaveCount(0);
});

test("the viewer offers one centred Save and nothing else", async ({ page }) => {
  await page.goto("/proto/guest/album/photo");

  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  await expect(page.getByRole("button", { name: /share/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "More" })).toHaveCount(0);

  await page.getByRole("link", { name: "Close" }).click();
  await expect(page).toHaveURL(/\/proto\/guest\/album/);
});
```

- [ ] **Step 5: Run tests, verify, commit**

```bash
git add src/app/proto tests/proto
git commit -m "Add prototype guest album and photo viewer"
```

---

### Task 12: Final pass

**Files:**
- Modify: whatever the checks turn up
- Create: `docs/superpowers/plans/2026-08-16-reference-ui-prototype-notes.md`

- [ ] **Step 1: Confirm the registry is complete**

Run: `npm run test:proto`
Expected: PASS. `walk.spec.ts` should now be running 34 route tests plus the index test. If the count is lower, a task skipped its registry entry.

- [ ] **Step 2: Check for leaked reference branding**

Run:

```bash
grep -rniE "once\.film|\bOnce\b|join\.once" src/app/proto || echo "clean"
```

Expected: `clean`. Any hit is the reference app's branding and must go.

- [ ] **Step 3: Confirm nothing outside the prototype changed**

Run:

```bash
git diff --name-only main...HEAD | grep -v "^src/app/proto/" | grep -v "^tests/proto/" | grep -v "^docs/"
```

Expected: only `playwright.config.ts` and `package.json`. Anything else violates the constraint that the prototype is deletable in one step.

- [ ] **Step 4: Full verification**

Run: `npx tsc --noEmit` — no output.
Run: `npm run lint` — no errors.
Run: `npm run build` — succeeds.

- [ ] **Step 5: Write the walkthrough note**

A short file listing the entry point (`/proto`), the coupon that works (`MEMOVUE100`), which file to edit to change pricing (`src/app/proto/rules.ts`) and data (`src/app/proto/mock.ts`), and the one-line instruction for deleting the prototype when it has served its purpose (`rm -rf src/app/proto tests/proto playwright.proto.config.ts`, then revert the two config edits).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Complete the reference-UI prototype"
```

---

## Self-review

**Spec coverage.** All 34 registered routes map to tasks 2–11. The 14 deviations are each pinned to a task and, where cheap, to an assertion: no Apple (3), no onboarding (nothing builds it), no suggestions (5), start date (5), no Skip (5), rupee pricing (7), no infinity (7), coupon gate (7), no participants/shots rows (9), no tapes (4, 9), no Website/Partner (9), no tapes bullet (9), unified Get started (2), Save-only viewer (11). The behaviours with no screenshot — retention line, capture animation, People roster, disabled download, Send/Save after reveal — are in tasks 8, 10 and 11.

**Placeholders.** None. Every code step carries real code; every screen step names the screenshot, the copy strings and the element order.

**Type consistency.** `RevealMode` is defined once in `rules.ts` and imported by `mock.ts` and Task 6. `PARTICIPANT_TIERS`/`SHOT_TIERS` live in `rules.ts` and are consumed by Tasks 7 and 8. `Plate`'s props (`index`, `className`, `sealed`) are fixed in Task 3 and used unchanged after. `Screen`/`SCREENS`/`screenAt`/`neighbours` are fixed in Task 2. `FilmHeader`'s `revealed` prop is used identically in Tasks 8 and 11.

**One gap closed during review:** Task 4's home test navigates to `/proto/film`, which Task 8 creates. Task 4 now adds a stub page so the test is honest at the time it is written.
