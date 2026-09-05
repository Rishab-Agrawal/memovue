# TODO

Things that need you, not code. Only open items live here — anything finished gets deleted
rather than archived.

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
- Decide what replaces the beta allow-list at launch, and what the free tier is

## Tighten DMARC to reject

The record is now `v=DMARC1; p=quarantine; rua=mailto:hello@memovue.com`, so anything that
fails alignment lands in spam rather than the inbox. `p=reject` is the end state: receivers
throw the message away instead of filing it.

Keep reading the aggregate reports arriving at hello@. Once a few weeks of them show only
Resend and Cloudflare Email Routing, and nothing legitimate failing, move to `p=reject`.
Under quarantine a mistake is recoverable from a spam folder; under reject it is not.
