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

## Publish a DMARC record

`memovue.com` has SPF on the apex (Cloudflare Email Routing) and Resend's DKIM at
`resend._domainkey.memovue.com`, but `_dmarc.memovue.com` does not exist. Gmail and Yahoo
now expect one from anything sending at volume, and without it a receiver has no instruction
for mail that fails both checks. Add a TXT record in Cloudflare DNS:

    _dmarc    TXT    v=DMARC1; p=none; rua=mailto:hello@memovue.com

Start at `p=none`, read the reports for a few weeks, then move to `p=quarantine`.

## Create the retention cron service on Railway

The sweep is written and tested (`npm run sweep`, `--dry` to preview) but nothing schedules
it, so no roll is ever actually deleted. In the **memovue** project: New → GitHub Repo →
`Rishab-Agrawal/memovue`, name it `memovue-sweep`, then Settings → Deploy:

- Start Command: `npm run sweep`
- Cron Schedule: `0 21 * * *` (21:00 UTC, 2:30am IST)

Variables, by reference so no secret is copied:

    DATABASE_URL=${{memovue-web.DATABASE_URL}}
    R2_ACCOUNT_ID=${{memovue-web.R2_ACCOUNT_ID}}
    R2_ACCESS_KEY_ID=${{memovue-web.R2_ACCESS_KEY_ID}}
    R2_SECRET_ACCESS_KEY=${{memovue-web.R2_SECRET_ACCESS_KEY}}
    R2_BUCKET=${{memovue-web.R2_BUCKET}}
    RESEND_API_KEY=${{memovue-web.RESEND_API_KEY}}
    EMAIL_FROM=${{memovue-web.EMAIL_FROM}}
    APP_URL=${{memovue-web.APP_URL}}
    AUTH_SECRET=${{memovue-web.AUTH_SECRET}}

Until this exists the terms and the privacy policy promise a deletion that does not happen.
