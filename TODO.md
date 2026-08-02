# TODO

Things that need you, not code. Captured 2 August 2026.

## Do soon

### 1. Change the admin password

The account `rishabsecond@gmail.com` is live in production with the password set during the
build session (`memovue-dev-2026`). It's an admin account because it matches `ADMIN_EMAIL`.

Change it at `/account`. **There is no password-reset flow yet** (see `KNOWN-GAPS.md`), so
put the new one somewhere you'll find it. Delete this section once done.

### 2. Turn on approval emails

`RESEND_API_KEY` isn't set, so approved hosts only discover it by signing back in. The admin
page shows a warning while this is the case.

- Sign up at Resend, verify a sending domain
- Set `RESEND_API_KEY` and `EMAIL_FROM` on the `memovue-web` service in Railway

Invite codes sidestep this entirely, so it isn't blocking your first few events.

### 3. Connect GitHub for auto-deploy

Railway's GitHub App can't see the private repo, so deploys currently happen from local via
`railway up`. Connect the repo in the Railway dashboard (Service → Settings → Source) to get
push-to-deploy.

### 4. Downgrade the R2 token

CORS and bucket config are applied, so nothing at runtime needs account-level access any
more. Mint an **Object Read & Write** token scoped to the `memovue` bucket, swap
`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` in Railway, then delete the admin token.

## When you buy memovue.com

**Do this before printing any QR codes.** QR codes encode `APP_URL`, so every code printed
against the Railway subdomain breaks the moment you move.

1. Add the domain in Railway (Service → Settings → Networking → Custom Domain) and set the
   DNS records it gives you
2. Update `APP_URL` on the `memovue-web` service to `https://memovue.com`
3. Run `npm run setup:r2` locally with `APP_URL` set to the new domain — this re-applies the
   R2 CORS policy so browser uploads are allowed from it. Uploads will silently fail from
   the new domain until this is done.
4. Load the site and check a QR code points at the right host before printing anything

## Housekeeping

- Delete the demo event *Aarav & Diya's Wedding* from your dashboard when you're done
  poking at it
- Run `npm run cleanup:test` occasionally if you run the Playwright suite against
  production — it creates real events and uploads real photos each run

## Before taking real money

Not urgent while the beta is free, but don't launch paid without them:

- Payments (India + international)
- Replace manual approval with self-serve signup
- Decide what the free tier is, if any
