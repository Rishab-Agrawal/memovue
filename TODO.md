# TODO

Things that need you, not code. Only open items live here — anything finished gets deleted
rather than archived.

## Change the admin password

`rishabsecond@gmail.com` is live in production with the password set during the build
session (`memovue-dev-2026`), and it is an admin account because it matches `ADMIN_EMAIL`.

Change it at `/account`. **There is still no password-reset flow** (see `KNOWN-GAPS.md`), so
put the new one somewhere you will find it. Delete this section once done.

## Turn on HSTS

Wait until around 18 August — roughly two weeks of stable HTTPS — then enable it in
Cloudflare under SSL/TLS → Edge Certificates. It is deliberately hard to undo, because
browsers cache the policy, so it is worth being sure first.

## Housekeeping

- Delete the demo event *Aarav & Diya's Wedding* from your dashboard when you are done with it
- Run `npm run cleanup:test` occasionally if you point the Playwright suite at production,
  since each run creates a real event and uploads real photos

## If you ever add a second email sender

SPF allows exactly **one** record per domain. Resend currently sends from the `send.`
subdomain, so it does not collide with the SPF that Cloudflare Email Routing put on the
apex. If you add another sending service later, merge its `include:` into the existing
record rather than adding a second one — two SPF records silently break deliverability for
both.

## Before taking real money

Not urgent while the beta is free, but do not launch paid without them:

- Payments (India and international)
- Replace manual approval with self-serve signup
- Decide what the free tier is, if any
