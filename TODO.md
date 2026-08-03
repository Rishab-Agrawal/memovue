# TODO

Things that need you, not code. Updated 4 August 2026.

## Done since this file was written

Infrastructure is finished — domain, storage, email and deploys are all live and verified.

- `memovue.com` is the canonical domain, DNS on Cloudflare, TLS issued, www 301s to the apex
- `APP_URL` is `https://memovue.com`, so QR codes encode the clean apex — **safe to print**
- R2 runs on a bucket-scoped Object token; the account-wide admin token is gone
- Railway auto-deploys from GitHub
- `hello@memovue.com` receives via Cloudflare Email Routing, and the app sends via Resend

## Do soon

### 1. Change the admin password

`rishabsecond@gmail.com` is live in production with the password set during the build
session (`memovue-dev-2026`), and it is an admin account because it matches `ADMIN_EMAIL`.

Change it at `/account`. **There is still no password-reset flow** (see `KNOWN-GAPS.md`), so
put the new one somewhere you will find it. Delete this section once done.

### 2. Turn on HSTS

Wait until around 18 August — roughly two weeks of stable HTTPS — then enable it in
Cloudflare under SSL/TLS → Edge Certificates. It is deliberately hard to undo, because
browsers cache the policy, so it is worth being sure first.

### 3. Optional hardening

`memovue-web-production.up.railway.app` still serves publicly and bypasses Cloudflare
entirely. Removing it in Railway closes that path. It exposes nothing extra — it is the
same app — it simply is not behind the proxy.

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
