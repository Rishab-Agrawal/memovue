# Reference-UI prototype (`/proto`)

**Date:** 16 August 2026
**Status:** approved, ready for planning

## Purpose

Rebuild MemoVue's interface around the flow of a vetted competitor ("Once"), whose
screenshots live in `uiux-reference/`. Before writing the real thing, produce a **clickable
dummy UI** covering every screen so the flow can be verified and corrected.

The prototype is the review artifact. It has no database, no auth, no network calls, and no
real photographs. Every screen is reachable from an index, and every screen renders with the
real Tailwind theme and typeface so that approving it approves the actual look.

## What this is not

- Not the implementation. No Prisma, no server actions, no R2, no email.
- Not a redesign. Layout, hierarchy, button placement and copy structure come from the
  reference. Only colour, typeface and the specific deviations below change.
- Not a clone. The palette, typeface, wordmark, cover art and product copy are ours.

## Source material

35 screenshots in `uiux-reference/`. All have been read. The create-film wizard shows a
six-dot pager; screenshots exist for dots 1, 2, 3, 5 and 6. Dot 4 was a step the reference
app has that we deliberately do not want, so our wizard drops it.

## Deviations from the reference

These override the screenshots.

| # | Reference behaviour | MemoVue behaviour |
|---|---|---|
| 1 | Sign in with Apple or Google | **Google only**, plus *Invited? Join film here* |
| 2 | Post-signup onboarding: "What brings you to Once?" then "When's the big day?" | **Both dropped.** Event type is removed from the product entirely — nothing depends on it. Signing up lands on the home screen. |
| 3 | Event-name step offers title suggestions | **No suggestions** |
| 4 | Film opens on creation; only a finish date is set | **Explicit start date step.** Start within 2 years of now; finish within 2 months of start. |
| 5 | Date step has a Skip button | **No Skip** |
| 6 | Prices in USD, independent of shots per person | **Placeholder rupee values**, a function of participants *and* shots, all in one editable file |
| 7 | Shots per person: 5 / 10 / 16 / 24 / 36 / ∞ | **5 / 10 / 16 / 24 / 36 / 100** — no infinity |
| 8 | Create → payment | Create → **coupon-code dialog**. A valid code is single-use, burned on redemption, and records which account used it. |
| 9 | Film settings include Participants and Shots per person | **Both removed** |
| 10 | A "Tapes" product and bottom-nav tab | **Removed entirely.** Bottom nav is Films + account. |
| 11 | Account settings: Instagram, Website, Contact Support, Partner/discount code | **Instagram and Contact Support only.** No Website (we are the website), no Partner section. |
| 12 | Delete-account dialog lists tapes | Line removed |
| 13 | App welcome screen replaces the marketing site | Marketing home stays, but its three CTAs — header, hero, and the closing "the parts you missed" section — all collapse to one **Get started** button pointing at the welcome screen |
| 14 | Full-screen viewer has Save (left), share and ⋯ | **Save only, centred.** Share and ⋯ dropped. |

Kept from the reference despite conflicting with prior MemoVue decisions:

- The guest **"Sign up to keep your memories alive"** banner stays. Guests therefore get real
  optional accounts; once signed up, events they attended appear under ALBUMS on their home
  screen. This is what the delete-account dialog's *"your participation in other events will
  no longer be attached to your account"* implies.
- **Reveal has three modes** — During Event, After Event, After Event + N hours — so a host
  can choose to have photos visible live. This supersedes the previous absolute rule that
  nobody sees anything before the reveal.

## Behaviours not visible in any screenshot

Stated here so they are not invented twice.

- **Guest sessions persist.** A returning guest resumes rather than rejoining.
- **Photos are kept one month.** Reminder emails at one week and one day before deletion.
  Surfaced in the UI as a quiet line under the album: *"Photos available until 15 Sep"*.
- **Album order is newest first**, by capture time.
- **Capture is not confirmed.** Tapping the shutter holds the frame for a beat, then animates
  it into the gallery thumbnail at bottom-right. No keep/retake step.
- **The gallery thumbnail** opens the album, locked or unlocked per the film's settings.
- **`People ›`** on the film home opens a sheet listing who has joined and how many shots each
  has used.
- **The ⤓ button** downloads the album as a ZIP; disabled before the reveal.
- **After the reveal**, the host's film home swaps the camera button for **Send** and **Save**,
  matching the guest view.
- **Image compression is already solved** and needs no new work: `src/lib/image.ts` resizes
  every capture in the browser to a 2048px long edge at quality 0.85 (plus a 1080px preview
  and a 32px blur placeholder) before any upload. That lands under 1 MB in practice, costs the
  server nothing, and adds no perceptible delay. No ffmpeg, no server-side pipeline.

## Visual language

Reference **shapes**, MemoVue **colour and type**.

- Rounded corners and filled card surfaces are adopted from the reference. The existing
  "no cards, no radius" rules in `WHATS-BUILT.md` do not apply to these screens.
- Accent blue becomes `--color-flame` (#FF8C00). Destructive red stays `--color-danger`.
- The reference's high-contrast display serif becomes **Archivo**, the app's single typeface.
  Hierarchy comes from weight and scale. This preserves the existing one-typeface decision.
- `globals.css` is **not modified**. Its radius overrides only cover `--radius-xs` … `--radius-xl`,
  so `rounded-2xl`, `rounded-3xl` and `rounded-full` resolve to Tailwind's defaults and are
  available to the prototype as-is. Existing colour tokens (`page`, `surface`, `chalk`, `ash`,
  `dust`, `hair`, `flame`, `danger`) cover everything else.
- No photographs. Every image — covers, presets, album tiles — is a deterministic CSS gradient
  plate, the same technique the current marketing page already uses for its sealed frames.

## Screens

34 routes — 24 distinct screens plus 10 linkable variants and dialogs. Everything is under
`/proto`. Variants that deserve their own link use a `?v=` search param; transient state
(open/closed toggles) is local component state.

### Shell

| Route | Screen |
|---|---|
| `/proto` | Index — every screen listed and grouped, with variants linked separately |

### Marketing

| Route | Screen |
|---|---|
| `/proto/marketing` | Public home page with all three CTAs collapsed to **Get started** |

### Entry

| Route | Screen |
|---|---|
| `/proto/welcome` | Welcome — Google, *Invited? Join film here*, legal line |
| `/proto/join` | Join film — scanner viewport, paste-link field, Join |
| `/proto/join?v=invalid` | Invalid-link dialog over the same screen |

### Host home

| Route | Screen |
|---|---|
| `/proto/home?v=empty` | No active films — empty state, **Create film**, ALBUMS below |
| `/proto/home` | One active film — cover card, countdown, camera button, ALBUMS |

### Create wizard

| Route | Screen |
|---|---|
| `/proto/new/name` | 1 — What is the name of your event? |
| `/proto/new/start` | 2 — When does your event start? (calendar + time) |
| `/proto/new/finish` | 3 — When does your event finish? (calendar + time, wheel modal) |
| `/proto/new/reveal` | 4 — Reveal: During / After / Additional Delay + hour stepper |
| `/proto/new/card` | 5 — Design your film invitation card |
| `/proto/new/card/preview` | Full-screen invitation preview |
| `/proto/new/guests` | 6 — Guests, shots per person, visibility → **Create** |
| `/proto/new/guests?v=coupon` | Coupon-code dialog |
| `/proto/new/guests?v=created` | Film Created dialog — share code and join link |

### Film (host)

| Route | Screen |
|---|---|
| `/proto/film` | Film home, before reveal |
| `/proto/film?v=revealed` | Film home, after reveal — Send / Save replace the camera |
| `/proto/film/invite` | Invite guests sheet — QR, Share Link, Save QR image |
| `/proto/film/invite?v=saved` | "QR code saved" success dialog |
| `/proto/film/people` | Participants sheet |
| `/proto/film/settings` | Film settings sheet |
| `/proto/film/settings?v=delete` | Delete film confirmation |
| `/proto/film/settings/info` | Edit film info — title, cover, presets |

### Account

| Route | Screen |
|---|---|
| `/proto/account` | Settings — name, Instagram, Contact Support, Logout, Delete Account |
| `/proto/account?v=delete` | Delete-account dialog |

### Guest

| Route | Screen |
|---|---|
| `/proto/guest` | Invitation landing — cover, "Invited by", countdown, name field |
| `/proto/guest/camera` | Camera — flash, 1x/2x, flip, counter dial, shutter, gallery |
| `/proto/guest/camera?v=captured` | Capture animation — frame collapsing into the thumbnail |
| `/proto/guest/camera/invite` | QR sheet reached from the camera header |
| `/proto/guest/album` | Before reveal — sealed tiles, "Reveals in 8h 31m", signup banner |
| `/proto/guest/album?v=after-host-only` | After reveal, visibility off — own photos only, Send / Save |
| `/proto/guest/album?v=after-everyone` | After reveal, visibility on — all photos with credits |
| `/proto/guest/album/photo` | Full-screen viewer — credit, timestamp, X, centred Save |

## Architecture

```
src/app/proto/
  layout.tsx          phone frame + Suspense + screen chrome
  page.tsx            index
  mock.ts             all fake data, one file
  proto.css           only what Tailwind tokens cannot express
  components/
    PhoneFrame.tsx    390x844 frame on wide viewports, full bleed on phones
    ScreenBar.tsx     prev / name / next, plus variant chips
    Sheet.tsx         bottom sheet with drag handle
    Dialog.tsx        centred modal
    Calendar.tsx      month grid with min/max clamping
    TimeWheel.tsx     hour/minute picker
    Counter.tsx       mechanical shot-counter dial
    Plate.tsx         gradient stand-in for a photograph
    ...
  <route folders per the table above>
```

Rules:

- Everything under `/proto` is self-contained. Nothing outside it is edited, so removing the
  prototype is deleting one folder.
- `mock.ts` is the only source of data. Pricing, tier labels, names, dates and counts are all
  editable there without touching a component.
- Screens are client components. The layout wraps `children` in `<Suspense>` so
  `useSearchParams` prerenders cleanly.
- Shared UI lives in `proto/components/`. A screen file should read as layout, not plumbing.

### Mock data

```ts
HOST      { name, initials }
FILM      { title, code, joinUrl, cover, startAt, finishAt, revealMode,
            revealDelayHours, participantCap, shotsPerPerson, everyoneCanSee,
            moments, people, keptUntil }
PHOTOS    [{ id, by, takenAt, plate }]          // newest first
PEOPLE    [{ name, shotsUsed }]
PRICING   { participantTiers: number[8], shotTiers: number[6],
            base: number[8], multiplier: number[6] }
COUPON    "MEMOVUE100"
```

Price for a combination is `base[p] * multiplier[s]`, rounded. Tier 1 (5 participants) is
free regardless. That is 14 editable numbers rather than a 48-cell table, and every
combination still gets a distinct price.

Participant tiers: 5, 10, 25, 50, 100, 200, 350, 500.
Shot tiers: 5, 10, 16, 24, 36, 100.

### Interactions that must actually work

Static screens are not enough to verify a flow. These behave:

- Wizard next/back moves between steps and carries state forward.
- Start-date calendar refuses dates more than 2 years out; finish-date calendar refuses dates
  more than 2 months after the chosen start.
- Reveal mode selection swaps the illustration between sharp, blurred, and blurred with a
  later timestamp; the hour stepper changes the quoted reveal time.
- Participant and shot selection updates the quoted price live.
- Visibility toggles flip their label between "Everyone can see all photos" and "Only host can
  see all photos".
- The coupon dialog accepts `MEMOVUE100` and rejects everything else with an inline error.
- The shutter runs the capture animation and decrements the counter dial.
- Album tiles open the full-screen viewer.

## Consequences for the real implementation

Recorded here because the prototype makes them unavoidable, not because they are in scope now:

1. **Event types are deleted.** `src/lib/event-types.ts` and the guest questions it drives
   ("which side are you on", "how do you know X") go away. The guest join screen asks for a
   name only.
2. **Google-only sign-in replaces email + password.** The existing admin account, the
   password-reset gap in `KNOWN-GAPS.md` §1, and the approval-queue signup all change shape.
3. **Films gain a start date**, so the current "capture runs from creation until reveal" model
   in `WHATS-BUILT.md` no longer holds.
4. **Reveal becomes three-valued**, so the absolute "the host cannot see photos early" rule
   becomes a per-film setting.
5. **Guests gain optional accounts**, contradicting "Guests get no account" in `KNOWN-GAPS.md`.
6. **Films become editable** after creation, closing `KNOWN-GAPS.md` §6.
7. **Coupons need a table** — code, redeemed-at, redeemed-by — and single-use enforcement.
8. **Retention needs a scheduled job** for the one-week and one-day emails, closing
   `KNOWN-GAPS.md` §4.

## Success criteria

Every screen in the table is reachable from `/proto`, walks forward and backward without a
dead end, renders correctly at 390px wide, and contains no reference-app text, imagery or
branding. `npm run lint` and `npx tsc --noEmit` pass.
