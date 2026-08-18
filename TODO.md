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
