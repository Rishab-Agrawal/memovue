# Memovue

## Description

A disposable camera for events. Guests shoot on their own phones from a QR code; every
photo stays sealed — even from whoever took it — until the host's reveal time, when the
whole album opens at once. Next.js 16 App Router, Prisma/Postgres, Cloudflare R2, Railway.

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ
from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before
writing any code. Heed deprecation notices.

## Standard

Code and design, from architecture down to single lines, as a very experienced senior engineer would write them: no bloat, nothing stale, no over-engineering, easy to maintain. The `ponytail` skill is a useful guide, not the whole standard.

- Comments: as crisp as possible. Never history, past mistakes or what changed.
- Keep diffs as small as possible. Not so commits are tiny: a small diff is evidence that nothing is bloated or over-engineered.
- When something goes stale, remove it in the same change.

## Problems are symptoms

A bug, bloat or over-engineering usually points to something larger: weak design, a missing concept, a wrong abstraction. Goodhart's law applies: fixing only the instance treats the measure as the target. Find and fix the root cause.

## Known and left alone

Nothing else in the repo records these. Don't re-investigate.

- `npm audit`: nine highs, all build-only, none ship. Never `--force` — it downgrades Prisma a major version.
- Cloudflare zone config is not in this repo: a cache rule pins edge and browser TTL to a year, Tiered Cache is on smart, and this plan has no rate limiting. Read it back with `npm run setup:r2 -- --rules`.
- Railway's spend limits live on the workspace usage page. Never copy the numbers into code.
- `main` deploys straight to production, one container. `ratelimit.ts`, `shouldAlert`, `rollTotals` and `buildOnce` keep state in memory — a replica makes them leaky, not wrong.
- DMARC is `p=reject`, verified 2026-09-05. Nothing else sends as `@memovue.com`.

Settled, reopen only with a new reason: cached URLs over signed, no reveal email, NDJSON rows over `pg_dump`, guest identity by cookie not by name.
