# TODO

Things that need you, not code. Only open items live here — anything finished gets deleted
rather than archived.

## Turn on HSTS

Enable it in Cloudflare under SSL/TLS → Edge Certificates. It was worth waiting for a couple
of weeks of stable HTTPS first, and that has passed. It is deliberately hard to undo, because
browsers cache the policy, so be sure before switching it on.

## Housekeeping

- Run `npm run cleanup:test` occasionally if you point the Playwright suite at production,
  since each run creates a real roll and uploads real photos

## If you ever add a second email sender

SPF allows exactly **one** record per domain. Resend currently sends from the `send.`
subdomain, so it does not collide with the SPF that Cloudflare Email Routing put on the
apex. If you add another sending service later, merge its `include:` into the existing
record rather than adding a second one — two SPF records silently break deliverability for
both.

## Before taking real money

Not urgent while the beta is free, but do not launch paid without them:

- Payments (India and international)
- Decide whether roll creation stays gated behind a coupon, and what the free tier is

## Tighten DMARC to quarantine

The record is published and reporting: `v=DMARC1; p=none; rua=mailto:hello@memovue.com`.
`p=none` asks receivers to tell us about failures and do nothing about them, which is the
right way to start and the wrong place to stop — it protects nobody from someone spoofing
the domain.

Read the aggregate reports arriving at hello@ for a few weeks. Once they show only Resend
and Cloudflare Email Routing passing, move to `p=quarantine`, and later `p=reject`. Do not
skip ahead: if anything legitimate is still failing alignment, quarantine sends it to spam.
