# MemoVue

A disposable camera for events. A host creates an event and gets one QR code; guests scan
it and shoot on their own phones with a fixed number of shots. Photos revealed at a time the host picked, downloadable in original quality.

Live at [memovue.com](https://memovue.com).

## Stack

| Concern  | Choice                                                       |
| -------- | ------------------------------------------------------------ |
| App      | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4   |
| Database | PostgreSQL via Prisma 7 (driver adapter)                     |
| Photos   | Cloudflare R2: presigned uploads, cached custom domain reads |
| Auth     | Hosts: Google sign-in. Guests: signed cookie, no account     |
| Hosting  | Railway                                                      |
| Tests    | Playwright, with a synthetic camera device                   |

## Running

```bash
npm install
cp .env.example .env.local   # every variable is explained there
npx prisma migrate deploy
npm run setup:r2             # allows browser uploads from your origin
npm run dev
npm test                     # Chromium with a fake camera: photos really are encoded and uploaded
```

Sign up with the address in `ADMIN_EMAIL` and that account becomes an admin, who mints the
referral codes every roll is created with at `/admin/referrals`.

## Scheduled jobs

Four Railway cron services, each safe to run twice and safe to miss. All take `--dry`.

```bash
npm run backup    # every row to R2 as gzipped NDJSON, rotated weekly
npm run sweep     # purge rolls past keptUntil, reclaim abandoned reservations
npm run digest    # the morning report to Telegram
npm run cost      # read both spend meters, alert if anything is wrong

npm run restore -- 2026-09-05 [--yes]   # read a backup back
```
