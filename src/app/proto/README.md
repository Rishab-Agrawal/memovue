# The prototype

A clickable dummy of the reworked interface, built from the competitor screenshots in
`uiux-reference/`. It exists to be walked and corrected, not shipped.

**Start at `/proto`** — every screen is listed there, grouped, in the order a host and then a
guest meet them. Each screen has a bar pinned at the bottom with `‹ prev` and `next ›`, so
you can walk it straight through or jump.

```
npm run dev        # then open http://localhost:3000/proto
npm run test:proto # the prototype's own Playwright suite, no database needed
```

On a phone, open the same URL against your machine's LAN address. On a desktop the screens
render inside a 390×844 frame; the marketing page is the one exception and runs full width,
because it is a desktop page.

## What is real and what is not

Nothing talks to a server. There is no database, no auth, no upload, no email. Every
photograph is a CSS gradient — the reference app's photos are theirs, and stock imagery
would make these screens look more finished than they are.

These behave for real, because a static screen cannot show whether the flow works:

- The wizard carries its draft across all six steps, forwards and back.
- The start-date calendar refuses dates more than two years out; the finish-date calendar
  refuses dates more than two months after the start.
- Reveal mode swaps the sample frames between sharp and sealed, and the delay stepper moves
  the quoted reveal time.
- Participant and shot selection reprice live.
- The shutter spends a shot and throws the frame into the gallery thumbnail.

## Where to change things

| What | File |
|---|---|
| Prices, tiers, date limits, countdown wording | `rules.ts` |
| Names, dates, counts, the film itself | `mock.ts` |
| The coupon that works (`MEMOVUE100`) | `mock.ts` |
| Which screens exist and their order | `screens.ts` |
| Date and time formatting | `format.ts` |

Prices are `base[participantTier] × multiplier[shotTier]` — fourteen numbers rather than a
48-cell table, and every combination still gets its own price. The values are placeholders.

Dates are read and written in UTC throughout, so the server and the browser cannot disagree
about what time it is. That is why `mock.ts` writes its instants with a `Z`.

## Removing it

The prototype is deliberately self-contained:

```
rm -rf src/app/proto tests/proto playwright.proto.config.ts
```

Then drop the `test:proto` script from `package.json` and the `**/proto/**` entry from
`testIgnore` in `playwright.config.ts`. Nothing else in the app imports from here.
