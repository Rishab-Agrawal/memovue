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

## Known and left alone

Short notes so none of this gets re-investigated.

- **Railway's own backups are Pro-only.** `memovue-backup` is the free equivalent — see the
  README. Switch to Railway's if you ever end up on Pro for another reason.
- **No staging.** `main` deploys straight to production, on purpose — a second environment
  costs another container and another database, and there are no other users yet.
- **The Postgres TCP proxy is open to the internet.** That is how local development and the
  Playwright suite reach the database; the password is the only thing in front of it.
- **`npm audit` shows nine highs, none reachable.** All of them are in the Next build
  pipeline or the Prisma CLI, and none ships. The `sharp` ones need `next/image`, which this
  app does not use. `npm audit fix --force` wants to downgrade Prisma a whole major version
  to clear them, so leave it — take the next Next minor when there is another reason to.
- **DMARC is `p=reject`, verified end to end.** A real app email on 2026-09-05 came back from
  Google as `dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=memovue.com`, with
  `dkim=pass header.s=resend header.i=@memovue.com` and `spf=pass smtp.mailfrom=send.memovue.com`
  — both mechanisms align on their own, so either one alone would carry a message. Cloudflare
  Email Routing re-signs forwarded mail as `header.s=cf2024-1 header.i=@memovue.com`, so the
  `hello@` forward stays aligned too. Nothing else sends as `@memovue.com`.
- **Uploads are not checked for being real JPEGs.** The presigned URL pins the content type
  and the exact byte count, the key is random, and the bucket is a separate domain — so the
  worst case is an object that renders as a broken image. Reading bytes back out of R2 to
  verify a magic number would cost a request per photograph to prevent that.

## Before taking real money

Not urgent while the beta is free, but do not launch paid without them:

- Payments (India and international)
- Decide what replaces the beta allow-list at launch, and what the free tier is
