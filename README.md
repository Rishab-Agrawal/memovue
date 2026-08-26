# MemoVue

A disposable camera for events. Guests shoot on their own phones, nobody sees a single
photo — not even the person who took it — until the reveal time the host picked, and then
the whole album opens at once.

## How it works

A host creates an event and gets one QR code. Guests scan it, type a name, and get a
camera with a fixed number of shots. Every frame goes straight to private storage and stays
sealed. At reveal time the album unlocks for everyone who was there, and the host can
download the lot in original quality.

## Stack

| Concern  | Choice                                                     |
| -------- | ---------------------------------------------------------- |
| App      | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4  |
| Database | PostgreSQL via Prisma 7 (driver adapter)                    |
| Photos   | Cloudflare R2, browser-to-bucket via presigned URLs         |
| Auth     | Hosts: Google sign-in. Guests: signed cookie, no account    |
| Hosting  | Railway                                                     |
| Tests    | Playwright, with a synthetic camera device                  |

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, AUTH_SECRET, R2_*
npx prisma migrate deploy
npm run setup:r2             # allows browser uploads from your origin
npm run dev
```

Sign up with the address in `ADMIN_EMAIL` and that account becomes an admin with beta
access, so you can create events immediately.

## Tests

```bash
npm test
```

The suite drives a real capture: Chromium runs with `--use-fake-device-for-media-stream`,
so photos are genuinely encoded, uploaded to R2 and confirmed. It also asserts the part
that matters most — that before the reveal, the only image data reaching the browser is an
inlined ~32px blur placeholder, and the photo API returns 403.

## Design decisions worth knowing

**One time control, not three.** The host sets a start time and picks how long until photos
unlock. Shooting runs from start until reveal, so there's no separate "event ends" field to
get wrong. `revealAt` is the single moving part.

**Shots are reserved before bytes are uploaded.** Tapping "Keep it" writes the photo to
IndexedDB first, then reserves a `PENDING` row, then uploads. A phone that dies mid-upload
loses nothing — the queue retries on next open or when it comes back online — and one photo
can never consume two shots.

**Guests have one session per name.** Recovering a name on a new device bumps a token
version, which signs the old device out. Someone hijacking a name is therefore immediately
obvious to whoever actually owns it, rather than silently sharing their quota.

**The host waits too.** There is no route that serves full images before `revealAt`, for
anyone, including the event owner. It's the whole product promise.

**Storage is separated by key prefix**, not by bucket, so local development can't collide
with a live event's album.

## Retention

A roll carries a `keptUntil`, set on creation to 30 days after it closes, and both the host
screen and every guest album print that date. The terms and the privacy policy therefore
promise *at least* that long and no upper bound, which is what the code actually delivers:
nothing sweeps expired rolls yet, and `sendDeletionNotice` is written but never called.
Wire both together, or neither. Deleting a roll or an account erases the database rows and
the R2 objects immediately.
