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
The cron jobs alert here too, when they fail, and the cost watch when the bill is over the line
or the limit that stops it has gone missing.

**Signals** is the pulse: a host signed up, a roll was created, somebody asked to be let in. One
line each, never urgent, and none of them a record — the rows behind them all outlive the message.

**Daily** is `npm run digest`, a third Railway cron service scheduled after the backup and the
sweep. It sends every morning whether or not anything happened, deliberately: a digest that only
arrives when there is news cannot be told apart from one that has silently stopped arriving.

Exactly one thing in it is not a number, and that one goes to **Alerts** instead: a scheduled job
whose heartbeat is absent. A job that is no longer scheduled raises no exception and fails no
deployment, so absence is the only evidence there will ever be — and evidence printed near the
bottom of a message full of pleasant statistics is evidence nobody reads. Everything left in the
digest is worth reading and none of it is urgent, which is what makes it safe to skip.

**Almost nothing is counted.** Rolls, hosts, guests and photographs are already rows with a
`createdAt`, so the digest counts *those* — which stays correct through a deploy, survives a
restore, and can still be asked about last March. What gets a `Metric` row is only what leaves
nothing behind: an invitation shown to somebody who never joined, an upload the queue gave up
on, a crash, and a tick from each scheduled job so that the digest can notice one having
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

## What this costs, and what stops it

Two meters run. **Railway** bills the container, the database and its egress by usage;
**Cloudflare** bills R2 for the bytes stored and the requests made against them. Nothing else
is metered: Telegram, Google sign-in, DNS and Email Routing are free, Resend is free below
three thousand messages a month against the single figures a week this sends, and the domain is
one fixed line a year that no daily job could usefully watch.

**The hard stop is Railway's, not this repo's, and that is the whole design.** Railway takes
every workload in the workspace offline by itself once the billing cycle's usage reaches the
hard limit set on the account. It does that at its own meter: it does not need this repo to
have deployed, a cron to still be scheduled, a token to still be valid, or any of this code to
be free of bugs. A kill switch written as "a job notices and calls an API" shares a failure
mode with the thing it guards — the runaway that stops the job running is the runaway that
nothing then stops.

**The numbers are not in this repo, and there is no command that writes one.** Both live on the
[Workspace Usage page](https://railway.com/workspace/usage) — an email alert and a hard limit —
and are read back live on every run. Change either one there, whenever, for any reason, and
nothing here needs touching or redeploying.

```bash
npm run cost           # read both meters, alert if anything is wrong
npm run cost -- --dry  # the same reading, sending nothing
```

That direction is the whole point. The account is the only place either number acts, so a
constant here that disagreed with it would not be a stricter policy, only a false one — and the
`--set-limits` this briefly had would, the first time the two drifted, have quietly *raised* a
limit somebody had tightened on purpose. A copy in the repo also turns "let it run higher for a
busy month" into a code change, and an alarm that nags every four hours until a file is edited
to agree with a dashboard is an alarm that gets muted.

So Railway's email alert is also the level this alerts to Telegram at, and Railway's hard limit
is the ceiling every message prints. The one thing asserted is that both still *exist*, never
what they say: whatever they read is somebody's considered choice, but *neither* never is —
that leaves nothing anywhere that stops the bill, and it is the state nothing else would report.
Railway's minimum is $10.

**The stop is workspace-wide.** It takes down every project in the same Railway account, not
only MemoVue, and the figure it compares against is that whole workspace's usage. That is also
the honest number to report, so the digest reports it rather than trying to attribute dollars
to one project — Railway's per-project figures are resource units, not money, and pricing them
here would be a second, worse copy of Railway's billing.

**What is left for code is the two things the platform does badly.** Railway announces all of
this by email, which is the one channel this project has already decided nobody watches. And a
limit set once in somebody else's dashboard can be lowered, raised or removed without anything
anywhere throwing an exception — the same shape of failure as a cron that quietly stopped being
scheduled, and it gets the same treatment. So `npm run cost` runs as a fourth Railway cron
service every four hours and says three things, in the order they matter: whether the limits
still read what this repo says they should, whether either meter could be read at all, and
whether the money is over the line. It repeats while the money is over, on purpose — six
messages a day is the right amount of nagging about a bill that is still climbing.

Four-hourly rather than nightly puts a ceiling of four hours on how long a runaway goes
unannounced, and guarantees a tick inside every Kolkata day whatever hour the digest runs at,
so the digest can notice this job having stopped the way it already notices the other two.

**A blind alarm is the failure that matters.** An unreachable meter comes back named rather
than thrown, so Cloudflare being down never costs the Railway reading — they are not the same
size, and Railway is where all the money is. A total assembled from one meter prints with a `+`
after it, because it is a floor and not the bill. Both APIs answer `200` with an `errors` array
when a token is revoked, so the status line is never read on its own: that would turn a dead
credential into a healthy zero.

**Railway's stop does not reach Cloudflare, and nothing can make it.** `cdn.memovue.com` is
served from Cloudflare's edge with no part of Railway in the path, so it keeps answering after
every workload is offline — and the sweep is offline too, so storage stops shrinking as well as
stops growing. Cloudflare sells no spend cap for R2 and publishes no usage notification for it,
so there is no platform switch to reach for the way there is on Railway, and a switch written
here would be useless in the one case that motivates it: this watch is stopped by the same hard
limit as everything else.

What bounds it instead is arithmetic. Egress is free, uploads need the app that has just been
stopped, and the two remaining meters are shallow: storage passes $10 a month at about 680 GB
stored, and reads pass $10 at roughly 38 million cache-*missing* requests in a month. So the
exposure after a Railway stop is single digits, and `R2_ALERT_USD` is set at $2 to fire long
before any of it — separately from the combined total, because Railway reading nearly zero is
exactly what would let R2 climb unnoticed inside a shared number.

The controls that do work are Cloudflare's own, because they are enforced at the edge whether or
not anything of ours is running: a **rate limiting rule** on `cdn.memovue.com`, and a **cache
rule** with a long edge TTL, which attacks the actual driver — a photo key is immutable, so a
miss should only ever happen once per edge. Covers are excluded from that rule: `coverKey` is a
fixed key overwritten in place and served through a stable `publicUrl`, so a long TTL would
serve a replaced cover's predecessor for as long as the TTL lasts.

**Email cannot cost anything, and that is the problem.** Resend's free plan is 3,000 a month and
100 a day, and it refuses with a `429` rather than billing — so exhausting it is free, silent,
and stops hosts hearing that their photographs are about to be deleted. `send()` therefore reads
the error out of the response body as well as catching throws, because Resend reports a refusal
in the body and an unread refusal is indistinguishable from a send. Every failure alerts. It is
not counted: at a handful of messages a month against three thousand, a number that far from its
limit is decoration, and this file's rule is that a figure with nothing to compare it to is left
out.

**R2 is priced, not billed.** Cloudflare has no figure to ask for, so `r2Bill` applies the
published prices to the storage and request counts out of the GraphQL analytics API — account
wide, because the free ten gigabytes and the first million writes are granted per account and a
second bucket eating them makes MemoVue's next gigabyte cost money. Storage is priced as a
whole month at today's size rather than accrued day by day, and an operation the classifier has
never heard of is charged at the dearer of the two request rates. Both round the estimate up:
too high sets the alarm off early, too low is the alarm not going off at all. The month is
UTC — Cloudflare's, not Kolkata's — because this figure has to line up with an invoice rather
than with an evening.

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
