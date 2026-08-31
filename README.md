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
| Photos   | Cloudflare R2: presigned uploads, cached custom domain reads |
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

**Images are served from a cached custom domain, not signed per request.** `publicUrl` builds a
stable link through the Cloudflare domain in front of the bucket, so a cache hit never reaches
R2 and viewing an album is free however often it is opened. Signed URLs bought nothing here:
they cannot be cached by the edge or the browser, so every tile of every album was a billed
read on every visit. Saving a photograph goes through the same cached URL — the viewer reads
it into a blob and names the file itself — so the only object still signed is the album ZIP.

**A key is a capability.** Because the domain is public, the key is the only thing standing
between a stranger and a photograph, so it carries a random segment that is not derivable
from anything a guest holds. This was learned the hard way: the first version keyed on
`{rollId}/{photoId}`, both of which a guest can read off their own upload URL and the sealed
wall, which briefly let any guest fetch anyone's original before the reveal.

Authorisation therefore happens once, where the list is built — `visiblePhotoWhere` decides
which rows exist, and a sealed roll returns no URL of any kind. A URL does not expire; it is
valid until the roll is purged. That is not a weakening of the seal, because the seal was
never the expiry.

## Retention

A roll carries a `keptUntil`, set on creation to 30 days past its close, and both the host
screen and every guest album print that date. `npm run sweep` is what makes it true: hosts are
emailed seven days out, recorded by `warnedAt` so it happens once rather than nightly, and a
roll past its date is purged bytes-first — R2 objects before the database row, so a failure
halfway leaves the roll listed and retryable rather than the storage stranded with nothing left
that knows its keys. It runs nightly as a Railway cron service, is safe to run twice and safe to
miss, and `--dry` reports what it would do without touching anything.

Every path that destroys a roll goes through the same `purgeRoll`. That is also the fix for a
leak it would otherwise have inherited: deleting a roll by hand used to take back only its
cover, and deleting an account touched storage not at all.
