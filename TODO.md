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

## Two things only the Railway dashboard can answer

Neither is code, and both are one click.

**Postgres backups.** The database runs on a Railway volume and nothing in this repo can tell
whether scheduled backups are switched on for it. Open the Postgres service, Settings, and
confirm there is a backup schedule. Every roll, every guest and every photo *row* lives there
— the image bytes are in R2, so a lost database is an orphaned bucket nobody can name.

**Staging.** `main` deploys straight to the thing guests are holding, and there is nowhere to
find out a change is wrong first. A second Railway environment off the same repo, pointed at
its own database, is the whole fix. It costs another container and another Postgres, which is
why it is here and not done.

## Two things left standing on purpose

**The Postgres TCP proxy is open to the internet.** `DATABASE_PUBLIC_URL` is how local
development and the Playwright suite reach the live database, and the password is the only
thing in front of it. Removing the proxy would close that off and take the dev loop with it,
so it stays until there is a separate database to develop against — see staging, above.

**`npm audit` reports nine high advisories, and all nine are unreachable.** They are in
`postcss`, `sharp`, `nanoid`, `fast-uri`, `mysql2` and `deepmerge-ts`, reached only through the
Next build pipeline and the Prisma CLI — none of it ships or runs in production. The sharp
ones need `next/image`, which this app deliberately does not use; `mysql2` arrives through
Prisma's dev tooling for a database we do not run. `npm audit fix --force` wants to downgrade
Prisma across a major version to clear them, which is a real change to fix nothing. Clear them
by taking the next Next minor when there is a reason to take it anyway.

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
