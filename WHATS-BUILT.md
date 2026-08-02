# What's built

Status as of **2 August 2026**. Written down so the reasoning behind the non-obvious
choices isn't lost.

- **Live:** https://memovue-web-production.up.railway.app
- **Repo:** https://github.com/Rishab-Agrawal/memovue (private)
- **Infra:** Railway (app + Postgres), Cloudflare R2 (photos)

## Surfaces that exist

| Area   | What's there                                                                                    |
| ------ | ----------------------------------------------------------------------------------------------- |
| Public | Landing page, join-by-QR, join-by-code fallback, terms, privacy                                   |
| Host   | Signup/login, beta-access request, event creation, event control panel, QR + printable card, live countdown, reveal-now, ZIP download, account page, password change, account deletion |
| Guest  | Join with event-type-specific questions, camera, review/retake, shot counter, blurred pre-reveal wall, post-reveal grid, full-screen swipe viewer, per-photo save |
| Admin  | Approval queue, invite code creation/revocation, platform stats                                   |

## Verification

The Playwright suite runs Chromium with `--use-fake-device-for-media-stream`, so it isn't
mocking the hard part — photos are genuinely encoded, uploaded to R2, and confirmed.

It also asserts the promise the whole product rests on: **before reveal, the only image
data reaching a browser is an inlined ~32px blur placeholder, and the photo API returns
403.** If that ever breaks, the test fails.

7 tests, passing both locally and against production. Run with `npm test`, or against
production with `TEST_BASE_URL=https://memovue-web-production.up.railway.app npm test`.

## Decisions that differ from the original brief

### One time control, not two

The brief described a reveal delay but no event end time. Capture now runs from **start
until reveal** — "12 hours" means guests shoot for 12 hours and then everything opens at
once.

*Why:* it removes a field from event creation, eliminates a way to misconfigure an event
(end time after reveal time), and matches how people actually think about a disposable
camera — shoot all night, see them in the morning. The host also gets a **Reveal now**
button for manual control.

### The host waits too

There is no route that serves full images before `revealAt` to anyone, including the event
owner. The ZIP download is gated on it.

*Why:* if the host can peek, the promise being made to guests isn't true. This is stronger
than the brief required, and it's the single most important invariant in the codebase.

### Invite codes alongside the approval queue

Admin can mint a code to hand over directly; the holder signs up with it and can create
events immediately, skipping the queue.

*Why:* the first customers are people who've already been pitched in person. Making them
fill a form and wait is friction with no upside. The queue stays for inbound requests.

### No localStorage token mirror

Session robustness comes from a 400-day httpOnly cookie, plus a **"that's me, I'm on a new
phone"** recovery path on the join screen.

*Why:* anything that clears cookies clears localStorage too, so the mirror adds nothing but
does put a bearer token where XSS can read it. Recovery bumps a token version, which signs
the previous device out — so one name means one active session, and a hijack is immediately
visible to whoever actually owns the name rather than silently sharing their shot quota.

### Captures are durable before they're uploaded

Tapping "Keep it" writes the photo to IndexedDB *before* any network call, then reserves a
`PENDING` row on the server, then uploads to R2.

*Why:* venue wifi is bad and phones lock mid-upload. A photo that only lived in memory
would be gone. The queue retries on next app open and on the `online` event, and because
the reservation is persisted, one photo can never consume two shots.

### Event type list

"Office outing" became **Team offsite**. Added Anniversary, Baby shower, Graduation, Party,
Trip, Festival, plus Other.

Relation questions are driven by type, from a single source of truth in
`src/lib/event-types.ts`:

- **Wedding / Anniversary** — host enters both partner names; guests pick one or Both, plus
  free-text relation. (Names rather than "bride/groom", as requested.)
- **Birthday / Baby shower / Graduation** — host names the guest of honour; guests answer
  "How do you know {name}?"
- **Party / Team offsite / Trip / Festival / Other** — name only.

The host can switch the relation question off entirely; they can't switch it on for a type
where there's no sensible question to ask.

## Other things worth knowing

- **Storage separation** — dev and production share the R2 bucket but are separated by key
  prefix (`dev/` vs `events/`), so local testing can't collide with a live album.
- **Photos never touch the app server** — browsers PUT directly to R2 via presigned URLs.
  Only the host's ZIP streams through the server.
- **Read URLs are signed per request** and expire within the hour, so a copied album link
  stops working instead of exposing the event forever.
- **Email is optional infrastructure.** Without `RESEND_API_KEY` the app works end to end
  and messages are logged instead of sent.
- **Design direction is "darkroom"** — warm near-black, ember accent, film grain. Chosen
  because the app is used at night in dim venues, the camera screen must be dark anyway,
  and a darkroom is literally where hidden images wait to develop.
