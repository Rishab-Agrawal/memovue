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

## Turn on database backups

Railway dashboard, five clicks:

1. Open the **memovue** project, click the **Postgres** service
2. **Settings** tab
3. Scroll to **Backups**
4. Turn on a **Daily** schedule
5. Check the retention it offers is at least 7 days

Why it matters: the image files are in R2, but every roll, guest and photo *row* is in
Postgres. Lose that and the bucket is full of objects nothing can name.

## Known and left alone

Short notes so none of this gets re-investigated.

- **No staging.** `main` deploys straight to production, on purpose — a second environment
  costs another container and another database, and there are no other users yet.
- **The Postgres TCP proxy is open to the internet.** That is how local development and the
  Playwright suite reach the database; the password is the only thing in front of it.
- **`npm audit` shows nine highs, none reachable.** All of them are in the Next build
  pipeline or the Prisma CLI, and none ships. The `sharp` ones need `next/image`, which this
  app does not use. `npm audit fix --force` wants to downgrade Prisma a whole major version
  to clear them, so leave it — take the next Next minor when there is another reason to.
- **Uploads are not checked for being real JPEGs.** The presigned URL pins the content type
  and the exact byte count, the key is random, and the bucket is a separate domain — so the
  worst case is an object that renders as a broken image. Reading bytes back out of R2 to
  verify a magic number would cost a request per photograph to prevent that.

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
