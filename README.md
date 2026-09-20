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

It writes to whatever `DATABASE_URL` names and creates real rolls there, so that had better
not be production's — see "No staging" below for how that went. `npm test` migrates first
via `pretest`, because the server it starts no longer does: `npm start` is `next start`
alone, and `prisma migrate deploy` is the web service's pre-deploy command on Railway. A
migration that fails now fails the deploy, with the previous version still serving, instead
of crash-looping the container that was about to serve it.

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

**A guest is a browser, not a name.** The signed cookie is the whole identity: one browser,
one `Guest` row, one shot quota. The name typed at the door is a caption on the photographs
and nothing ever compares it to anybody else's — a wedding has two Riyas and a Meera on each
side of the family, and the door has to let all of them in.

It used to be the opposite. A name was unique inside a roll, the second person to type one
was refused, and they were offered a "that's me, I'm on a new phone" button that bumped a
token version and signed the real owner's phone out. That flow existed to serve one rare
case — the same person on a second device — by breaking a common one, and the rare case
already has a better answer: sign in on the first phone and sign in on the second, and
`getGuestContext` finds the row by account rather than by cookie.

What the cookie costs is a browser cleared mid-event: those photographs stay in the album
under the name that took them, but the phone comes back as a stranger, spends another spot
off `maxGuests` and gets a fresh quota. Nobody can un-take a shot either way, so the roll
still cannot be made endless. Two people sharing one phone are one guest, for the same
reason.

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
A cover is the one image whose bytes can change under a fixed key, so its URL carries
`?v={coverVersion}`: a replaced cover is a URL the edge has never seen, rather than a purge.

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

**Every alert is written here, not by the error.** Three times a line reached Alerts that its
reader could not understand — `NEXT_REDIRECT`, a Jest worker, *The database connection is
closing* — and each time the fix was to recognise that one sentence, which can never be
finished: browsers, libraries and servers can say anything. So `alert()` no longer takes text.
It takes an `Alert` from `src/lib/alert-text.ts` — *what happened*, *what it means*, *what to
do* — written in this repo and chosen by the *kind* of fault (a phone, a page, a button, a
nightly job: a short list we own) rather than by its wording (an endless one nobody does).
Whatever the machine said still goes along, last, under *Technical detail*, because that is
where a fix starts. `notify` cannot reach the alerts topic at all, so there is no other way in,
and `tests/unit/alert-text.spec.ts` feeds the rule errors nobody has written a word about.

**Nothing is sent from a laptop.** `.env.local` carries the same bot token, chat id and topic
ids as the deployment, deliberately: a notification channel that cannot be exercised before it
ships is one nobody finds out is broken until the night it matters. What that cost, until
`env.isDeployed` was put in front of every send, is that development wrote into the live group —
the end-to-end suite announced a new host and a new roll for every fixture it made, and a dev
server whose compile worker died sent *Jest worker encountered 2 child process exceptions,
exceeding retry limit*, a sentence about Next's own build tooling on somebody's laptop, to the
one topic allowed to wake anybody up. `RAILWAY_ENVIRONMENT` is the test, because `NODE_ENV`
cannot be: `next start` says production on a laptop too, and the cron services run plain `tsx`
with no `NODE_ENV` at all. Off a deployment the message is printed instead, so `npm run digest`
still shows exactly what it would have sent. `npm run verify:telegram` is the one thing that
still posts from anywhere, because proving the send works from where you are standing is its
whole job.

**And only our own scripts are reported.** A guest's phone is not a clean room. An extension
throws with a `chrome-extension://` filename, a script from another origin is blanked by the
browser before we see it, and a synthesised event names no source at all — so `report.ts` asks
where the code came from and reports nothing else. A positive test rather than a list of the
junk seen so far, because such a list only ever grows and every entry on it is written the
morning after a message nobody could read.

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

**Query** is the one that answers. `/rolls` lists every host with a roll and how many they
have, `/rolls all` everyone who has signed in, zero included; `/rolls someone@gmail.com` sends each of that host's rolls — dates, reveal, size, and once
it has started, shots per person. Telegram posts to `/api/telegram`, signed with
`TELEGRAM_WEBHOOK_SECRET`, and anything outside that topic is ignored. Deleted rolls show up
too: `purgeRoll` writes a `DeletedRoll` in the same transaction as the delete — who deleted it,
when, and the roll's settings and counts with every guest unnamed — and it goes with the host's
account.

**Every topic is the group, and none of them is a DM.** `TELEGRAM_CHAT_ID` is read out of
`getUpdates`, which lists every chat the bot has seen — and the bot has always been opened
privately before the group was made, so the natural thing to copy is your own user id. Telegram
then accepts every message, answers `ok`, logs nothing, and ignores `message_thread_id`, because
a private chat has no topics: three channels read at three different speeds arrive as one
undifferentiated stream in a DM. A group's id is negative and a supergroup's starts `-100`, so
`env.ts` refuses a positive one — a hard error anywhere but a deployment, where the mistake is
always made, and the channel simply switched off on one, where a notification setting must not
be able to take the site down mid-party. `npm run verify:telegram` checks the rest by posting one
message to each topic and reading back the thread it actually landed in, which is the only thing
that catches a deleted topic, a demoted bot, or a thread id copied from the wrong place.

**Almost nothing is counted.** Hosts, guests and photographs are already rows with a
`createdAt`, so the digest counts *those* — which stays correct through a deploy, survives a
restore, and can still be asked about last March. What gets a `Metric` row is only what leaves
nothing behind: an invitation shown to somebody who never joined, an upload the queue gave up
on, a crash, and a tick from each scheduled job so that the digest can notice one having
quietly stopped being scheduled.

Rolls are the exception, and were the exception before anybody noticed. A roll has a `createdAt`
like everything else, but rows are deleted — a host changing their mind an hour later, an
evening spent testing, and eventually the retention pass, which takes every roll thirty days
after it finished. Counted straight, a day somebody used the product read as a day nobody did,
and every figure from last March shrank a little each time the sweep ran. So creation is tallied
too, and the digest takes whichever of the tally and the rows is larger: neither can count a
roll that was never made, and the days before the tally existed stay right without a backfill. That table has three columns, no identifier of any kind, and
nothing joins to it, so no row in it can be turned back into one person's evening. It is the
strongest instrument that keeps the promise the privacy page makes.

**A host is not one of their own guests, as far as the digest is concerned.** They are enrolled
in their own roll at creation, so a `Guest` row stopped meaning "somebody accepted an
invitation" — and counted straight, every roll made added a join to a funnel whose top its host
never passed through. The one query in the digest that is raw SQL is raw because that exclusion
compares a guest's `userId` against their roll's `hostId`, across two tables.

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

`30 */4 * * *`, and the half hour is not cosmetic. Railway's cron is UTC while the heartbeat is
filed under a Kolkata date, so the schedule has to be read in that zone to check it: it fires at
02:00, 06:00, 10:00, 14:00, 18:00 and 22:00 IST, which puts two ticks inside every Kolkata day
before the digest reads them at 09:30. On the hour it would instead start in the same minute as
the digest and race it for the row it is about to look for.

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
not anything of ours is running. Two of them, neither in this repo:

- A **cache rule** overriding both **edge TTL** and **browser TTL** to a year. Edge TTL attacks
  the driver — a photo key is immutable, so a miss should only ever happen once per region —
  and browser TTL is what keeps the second look off the network entirely. Both are set here
  rather than as a `Cache-Control` header on the objects, deliberately: a header only reaches
  what is uploaded after it ships, so every photograph already in the bucket would keep
  whatever it was stored with, and one place to set a TTL is how a TTL avoids being two
  numbers that disagree.
- **Tiered Cache**, on smart topology. Without it every one of Cloudflare's data centres misses
  independently on the same photograph, so the first view in each region is its own billed
  read; with it they fill from one upper tier and R2 sees the object once.

This file used to say covers were excluded from that rule, because `coverKey` is a fixed key
overwritten in place and a long TTL would serve a replaced cover's predecessor. The rule never
excluded them — it matches the hostname and nothing else — so what was actually happening is
that a host who swapped their cover kept seeing the old one, for up to a year in their own
browser, where no cache purge can reach. Written config beat the written description, which is
the argument for `npm run setup:r2 -- --rules` reading the rule back rather than this paragraph
being trusted.

Covers are correctly cacheable now: `coverUrlFor` appends `?v=` from `Roll.coverVersion`, bumped
on every adoption. The query string is part of Cloudflare's default cache key, so a new cover is
a URL neither the edge nor the browser has seen, and the old one ages out unreferenced.

None of that is deployable from here, so `npm run setup:r2 -- --rules` **reads the cache rule
back** — live edge and browser TTL, and whether any rate limiting exists — and exits non-zero if
the rule is gone or a TTL is under a day. `npm run setup:r2` runs the same check after writing
the bucket's CORS. It never writes them: they are zone configuration and somebody's considered
numbers, the same argument the cost watch makes for Railway's spend limits. Not being able to
read them — no `CLOUDFLARE_API_TOKEN`, or one without `Zone: Read`, `Cache Rules: Read` and
`Zone WAF: Read` — prints a warning rather than failing, because absence of evidence and
evidence of absence are not the same finding.

That distinction is not academic here. Every claim in this file about code was true when
checked; both claims it made about Cloudflare's dashboard were false — a cover exclusion on the
cache rule that was never there, and the rate limiting below. Config in somebody else's console
is the one thing prose cannot keep honest, which is the entire argument for reading it back.

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

## Referral codes, and why they are a name rather than a coupon

A wedding planner, a florist or a photographer is already standing between us and every host
we want. They have no reason to mention us, and nothing to sell yet — the product is free.
What they do have is a wall of clients who will each hand a QR code to two hundred guests.

So the deal is attribution. A business gets a code, their customer types it into the wizard's
first step, and from then on the roll's home screen — the one screen every guest passes
through, repeatedly, for a month — carries that business's name, logo and link. Nothing is
spent and nothing expires: `Referrer` is a row with a code and a name on it, and a roll points
at one. When rolls start costing money, a discount belongs on that same row.

Four decisions worth keeping:

**The code is checked on Next, not at Create.** It is printed on a card somebody was handed,
so it gets mistyped, and the step it is typed on is four screens from the one that writes
anything. Finding out at the end that the florist will not be credited is finding out too
late. It is then resolved again at creation, because that is the write and the first check was
a browser's. The field itself is one unlabelled row: an explanation of something almost nobody
fills in was pushing Cancel and Next off the bottom of a phone.

**Everything about a code is editable, the code string included.** A business renames itself,
moves domain, or was typed in wrong on a Tuesday, and none of that is a reason to retire a
code already printed on somebody's cards. Rolls point at the row's id, never at the string, so
an edit follows every roll the code has ever created.

**A logo is theirs, unless they have nowhere to put one.** The normal case is a URL on their
server: nothing is copied, and a link that has rotted takes the picture out of the card and
leaves the name rather than a broken-image glyph in somebody's wedding album for thirty days.
For a business with no site, the admin screen takes a file, shrinks it to 320px in the browser
and stores it in R2 under one key per business — bytes we pay for, which is why it is the
fallback and not the default. Either way it is drawn on a white plate, because a logo drawn
for a letterhead is invisible on this app's black; an uploaded one is flattened onto white on
the way in, since a transparent PNG written into a JPEG comes out black.

**`REFERRALS` in `constants.ts` is the whole switch.** False takes the field out of the
wizard, the card off both roll screens and the section off the admin screen. What it does not
touch is the Telegram messages — a roll that was referred stays referred in the `/rolls`
query, the creation signal and the morning digest, because that is a record of what happened
rather than a feature that can be turned off.

A business can also give an address, and then hears once per roll its code created and about
nothing else. It is the only mail a referral partner ever gets, so there is no list to leave.

## One container, and the five things that assume it

MemoVue runs as a single Railway instance in `us-west2`, and that is a fine choice at this
size. What is not fine is that the assumption was written down five separate times, in five
files, each explaining itself locally — so "can we run two?" had no answer short of reading
all of them. Here is the list. Adding a replica means doing something about every row.

| Where | What it holds | What two replicas would do |
|---|---|---|
| `lib/ratelimit.ts` | every budget, in a `Map` | each limit becomes N times weaker |
| `lib/ratelimit.ts` — `outOfGuesses` | wrong roll codes per IP | a code-guesser gets N times the attempts |
| `lib/ratelimit.ts` — `shouldAlert` | which faults were announced | one fault pages N times |
| `api/r/[code]/feed` — `rollTotals` | a roll's counts, 10s | N times the aggregate queries; still correct |
| `api/rolls/[id]/download` — `buildOnce` | the in-flight archive build | one roll's ZIP built N times at once |

Two properties they share. None of them is a correctness guard — the seal, ownership and
quota are all decided per request against the database, so a second replica would make the
app wasteful and its limits leaky, not wrong. And none of them survives a restart: a deploy
mid-event resets every budget and every alert cooldown, which is worth remembering when
reading a quiet alerts channel just after a deploy.

The fix, when it is needed, is one shared store — Redis, or Postgres rows — behind
`ratelimit.ts` and `rollTotals`. `buildOnce` wants a row on `Roll` instead.

## Known and left alone

Short notes so none of this gets re-investigated.

**Railway's own backups are Pro-only.** `memovue-backup` is the free equivalent — see the
nightly backup above. Switch to Railway's if you ever end up on Pro for another reason.

**There is no rate limiting on `cdn.memovue.com`.** Cloudflare sells rate limiting rules as a
paid add-on on this plan, and this file claimed one existed for weeks before anything checked.
What bounds a flood instead is the key design: a photograph's key is an unguessable capability,
so a stranger can only ask for URLs somebody handed them, and those are edge hits that never
reach R2 — free, however many times they are asked for. Forcing *misses* means holding many
distinct valid keys, which means being in the roll, and Smart Tiered Cache collapses even that
to one origin fetch per object. The backstop is `R2_ALERT_USD` at $2, four hours at worst.
Buy the add-on if the app ever serves anything cheap to guess.

**No staging.** `main` deploys straight to production, on purpose — a second environment
costs another container and another database, and there are no other users yet.

**But local development and the tests must not share production's database.** That is a
different thing from staging, and it was not deliberate. `.env.local` pointed at the same
Postgres the site runs on, so `npm run dev` wrote production rows and `npm test` ran
`prisma migrate deploy` against it — which meant every migration reached production having
never run anywhere, and the suite was too dangerous to run, so it did not get run.

There is a second Postgres for that now — `Postgres-dev`, in the same project, reached over
its own TCP proxy. It is what `.env.local` points at, and `R2_PREFIX=dev` beside it keeps the
suite's uploads out of the live album's half of the bucket. The end-to-end suite is safe to
run and passes 26/26.

It also produced a bug that outlived every roll it touched. `storage.ts` picks its key prefix
from `NODE_ENV` — `events` in production, `dev` everywhere else — which is only safe while one
database is reached by one of them. A roll created from a laptop stored its cover under
`dev/covers/…`, and the production sweep, which recomputed the key rather than reading it,
asked the bucket to delete `events/covers/…`. The object survived its own roll's deletion,
unreachable by anything that could have found it again. `purgeRoll` now deletes the
`coverKey` recorded on the row. Point `DATABASE_URL` in `.env.local` at a database that is
not this one.

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
