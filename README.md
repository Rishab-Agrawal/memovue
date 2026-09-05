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

**Capture and reveal are separate moments.** Shooting runs `startsAt`..`finishesAt`; the
album opens at `revealAt`, which is the close, or the close plus a delay, or never sealed at
all. `revealAt` is derived on every write and never accepted from input, so the two can't
drift apart.

**The camera carries its own clock.** The close is a moment, not a page-load check: a
viewfinder left open closes itself the instant the roll ends. Without that, a guest with film
left went on shooting long after the party, and those frames landed in the album dated as if
they were taken during it — because the reserve route deliberately cannot tell them from a
photo captured in time and drained from a taxi.

**Shots are reserved before bytes are uploaded.** Tapping the shutter writes the photo to
IndexedDB first, then reserves a `PENDING` row, then uploads. A phone that dies mid-upload
loses nothing — the queue retries on next open or when it comes back online — and one photo
can never consume two shots. A reservation the queue gives up on is handed back rather than
quietly costing the guest a shot, and one nobody ever comes back for is swept a week later.

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

## The nightly sweep

`npm run sweep` runs as a Railway cron service. Safe to run twice, safe to miss, and `--dry`
reports what it would do without touching anything. It only ever deletes — nothing a guest
would notice happens on this schedule, deliberately.

**Retention.** A roll carries a `keptUntil`, set on creation to 30 days past its close, and
both the host screen and every guest album print that date. Hosts are emailed seven days out,
recorded by `warnedAt` so it happens once rather than every night, and a roll past its date is
purged bytes-first — R2 objects before the database row, so a failure halfway leaves the roll
listed and retryable rather than the storage stranded with nothing left that knows its keys.

**Abandoned reservations.** A `PENDING` photo row spends its guest's shot from the moment it
is written. The upload queue hands its own back the instant it decides a photograph will never
land; a week on, this takes the rest — the phone that reserved and then never ran again.

Every path that destroys a roll goes through the same `purgeRoll`. That is also the fix for a
leak it would otherwise have inherited: deleting a roll by hand used to take back only its
cover, and deleting an account touched storage not at all.

**There is no reveal email**, and that is a decision rather than an omission. A reveal is a
clock reading, not an event — `revealAt` is a column, and a date passing executes nothing — so
sending mail at that moment needs a worker holding a timer. That is real infrastructure for a
message reaching only the minority of guests who have accounts, who are also the only ones
with the roll already on their home screen. The album polls and unseals itself for anyone
watching; everyone else finds out by opening it. What we send instead is the one thing a
person cannot find out by looking: that their roll has filled up, and that photographs are
about to be deleted.

## The nightly backup

`npm run backup` runs as a second Railway cron service, two hours ahead of the sweep — before
it, deliberately, so a roll wrongly purged tonight is still in last night's copy.

The photographs are in R2; everything that says *what* a photograph is lives in Postgres, and
losing that leaves a bucket full of objects nothing can name. Railway takes scheduled backups
on its Pro plan and not below it, so this is that job: every row, as gzipped NDJSON, into the
same bucket, keyed by date and rotated after a week. The privacy policy already promised
backups age out within thirty days, which this sits well inside.

**Rows, not `pg_dump`.** The database is Postgres 18 and the newest client Railpack's apt will
install is older than that, which `pg_dump` refuses outright. The schema is not in the file
either, because it is already in git — a restore replays `prisma/migrations` first and then
the rows.

Dates are transcribed rather than parsed, and that is the whole reason `connect()` exists.
node-postgres reads a zone-less `timestamp` in the *process's* local time, so a backup taken
on a laptop in India and restored anywhere else moved every date in the database by five and a
half hours — every reveal, every closing time, every deletion date, silently and plausibly.
Handing back the string Postgres printed removes the question.

```bash
npm run backup                      # take one now
npm run restore -- 2026-09-05       # read it back, write nothing
npm run restore -- 2026-09-05 --yes # actually restore
```

A restore inserts `ON CONFLICT DO NOTHING`, so a row still present in the live database is
left alone: it is newer than the copy in the file, and skipping it is the only answer that
cannot lose anything.

## Knowing whether any of this works

Everything the owner needs to know goes to one Telegram group, split into three topics because
they are read at three different speeds.

**Alerts** is the only one allowed to interrupt anybody. `src/instrumentation.ts` exports
`onRequestError`, so every exception thrown out of a render, a route handler or a server action
arrives there with no call site having to remember anything — and it carries the same `digest`
string `error.tsx` prints on the screen the guest is looking at, so a photograph of a phone and
a line on a lock screen name the same failure. `instrumentation-client.ts` is the other half:
the camera runs on a stranger's phone at a party nobody from here is at, and a `getUserMedia`
refusal or a canvas encode that only fails on one model of handset never reaches a server log at
all. Both are deduplicated by `shouldAlert`, one message per fault per ten minutes and twenty an
hour across everything, because an alarm channel that floods during an outage is the outage.
The two cron jobs alert here too, when they fail.

**Signals** is the pulse: a host signed up, a roll was created, somebody asked to be let in. One
line each, never urgent, and none of them a record — the rows behind them all outlive the message.

**Daily** is `npm run digest`, a third Railway cron service scheduled after the backup and the
sweep. It sends every morning whether or not anything happened, deliberately: a digest that only
arrives when there is news cannot be told apart from one that has silently stopped arriving.

**Almost nothing is counted.** Rolls, hosts, guests and photographs are already rows with a
`createdAt`, so the digest counts *those* — which stays correct through a deploy, survives a
restore, and can still be asked about last March. What gets a `Metric` row is only what leaves
nothing behind: an invitation shown to somebody who never joined, an upload the queue gave up
on, a crash, and a nightly tick from each cron job so that the digest can notice one having
quietly stopped being scheduled. That table has three columns, no identifier of any kind, and
nothing joins to it, so no row in it can be turned back into one person's evening. It is the
strongest instrument that keeps the promise the privacy page makes.

The one exception is `Roll.albumOpenedAt`, which is a column rather than a tally because the
question is per-roll and permanent: how many albums are ever opened at all — which is to say,
whether sealing them was worth doing.

**The day is Kolkata's, not UTC.** A UTC bucket cuts an Indian wedding in half at half past five
in the morning, so one evening's scans would land under two dates and every ratio in the digest
would be wrong by however much of the party ran late. `format.ts` already owned that clock. The
day is stored as `YYYY-MM-DD` text for the same reason the backup transcribes its dates rather
than parsing them: a zone-less `date` column is moved by whichever machine writes to it.

## What a host can change, and what they cannot

The closing time moves while a roll is still sealed, because parties run late and the shutter
used to close on schedule regardless. Everything derived from it moves too — `revealAt`, and
the deletion date printed on every guest's album. Once the album is open there is nothing left
to move, and the row disappears.

The guest limit only goes up, one tier at a time, from the People screen — and the host is
emailed by the join that fills it, because a cap reached mid-event turns people away at the
door while the only person who can fix it is holding a drink.

A host can take one photograph out of the album, or one guest out with everything they shot.
Guests can do neither: un-taking a shot would hand the quota back and make the roll endless,
and the host is the person a subject actually asks.

## Known and left alone

Short notes so none of this gets re-investigated.

**Railway's own backups are Pro-only.** `memovue-backup` is the free equivalent — see the
nightly backup above. Switch to Railway's if you ever end up on Pro for another reason.

**No staging.** `main` deploys straight to production, on purpose — a second environment
costs another container and another database, and there are no other users yet.

**The Postgres TCP proxy is open to the internet.** That is how local development and the
Playwright suite reach the database; the password is the only thing in front of it.

**`npm audit` shows nine highs, none reachable.** All of them are in the Next build pipeline
or the Prisma CLI, and none ships. The `sharp` ones need `next/image`, which this app does
not use. `npm audit fix --force` wants to downgrade Prisma a whole major version to clear
them, so leave it — take the next Next minor when there is another reason to.

**DMARC is `p=reject`, verified end to end.** A real app email on 2026-09-05 came back from
Google as `dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=memovue.com`, with
`dkim=pass header.s=resend header.i=@memovue.com` and `spf=pass smtp.mailfrom=send.memovue.com`
— both mechanisms align on their own, so either one alone would carry a message. Cloudflare
Email Routing re-signs forwarded mail as `header.s=cf2024-1 header.i=@memovue.com`, so the
`hello@` forward stays aligned too. Nothing else sends as `@memovue.com`.

**Uploads are not checked for being real JPEGs.** The presigned URL pins the content type and
the exact byte count, the key is random, and the bucket is a separate domain — so the worst
case is an object that renders as a broken image. Reading bytes back out of R2 to verify a
magic number would cost a request per photograph to prevent that.
