# Wave 1 — the rework, on real routes, with a real backend

> **Goal:** the reviewed prototype becomes the actual app: real routes, real data, Google
> sign-in, coupon-gated creation, deployed to memovue.com. `/proto` ceases to exist.

**Spec:** `docs/superpowers/specs/2026-08-16-reference-ui-prototype-design.md`
**Prototype (the visual reference, deleted by T5):** `src/app/proto/`

## Cutover strategy

Local dev currently points `DATABASE_URL` at the **production** Postgres. If the destructive
migration runs there on day one, memovue.com breaks immediately and stays broken for the
whole build.

So: **provision a separate dev database first (T0).** Production keeps serving the current
code, against the current schema, untouched, until a single cutover window at the end (T11).
The live site's total downtime is the length of that window rather than the length of Wave 1.

Production data is discarded at cutover — the demo roll and its R2 objects. Authorised.

## Global constraints

- **Read the bundled Next docs before writing code.** `node_modules/next/dist/docs/01-app/`.
  `AGENTS.md` requires it; this is not the App Router you remember.
- The word is **roll**, never film. "Album" means a roll that has ended. "Event" means the
  occasion, and survives only in prose.
- Nothing new gets a `film-` or `event-` prefix. The Prisma model is `Roll`.
- Every screen already exists under `src/app/proto/` and has been approved. **Move it, don't
  redesign it.** UI changes are deferred until the deploy is testable.
- `npm run lint`, `npx tsc --noEmit` and `npm run build` pass at the end of every task.

---

## The schema

Complete final state. Everything not listed is deleted.

```prisma
enum Role { HOST ADMIN }
enum RollStatus { ACTIVE ARCHIVED }
enum RevealMode { DURING AFTER DELAY }
enum PhotoStatus { PENDING READY }

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  // Google's stable subject claim. Nullable so a user created by an admin or a test
  // fixture exists before anyone signs in as them.
  googleId  String?  @unique
  avatarUrl String?
  role      Role     @default(HOST)
  // Bumped by "sign out everywhere" so live JWTs stop validating.
  tokenVersion Int   @default(0)
  createdAt DateTime @default(now())

  rolls    Roll[]
  guests   Guest[]   // rolls they attended, once they have an account
  coupons  Coupon[]
}

model Roll {
  id     String @id @default(cuid())
  code   String @unique
  hostId String
  host   User   @relation(fields: [hostId], references: [id], onDelete: Cascade)

  name String
  // R2 key for an uploaded cover. Null means fall back to `coverPreset`.
  coverKey    String?
  coverPreset Int     @default(0)

  maxGuests      Int
  photosPerGuest Int
  // false: guests see only their own photos, the host sees all.
  everyoneCanSee Boolean @default(false)

  // Capture runs startsAt..finishesAt. The reveal is a separate moment, which is the
  // change from the old model where finishing and revealing were one control.
  startsAt   DateTime
  finishesAt DateTime

  revealMode       RevealMode @default(AFTER)
  revealDelayHours Int        @default(0)
  // Derived from finishesAt + mode + delay on every write. Stored, not computed, so the
  // retention sweeper can query it without loading every row.
  revealAt         DateTime
  revealedEarly    Boolean    @default(false)

  status    RollStatus @default(ACTIVE)
  // finishesAt + 30 days. What the deletion job reads.
  keptUntil DateTime
  warnedAt  DateTime?
  createdAt DateTime   @default(now())

  guests Guest[]
  photos Photo[]
  coupon Coupon?

  @@index([hostId])
  @@index([keptUntil])
}

model Guest {
  id     String @id @default(cuid())
  rollId String
  roll   Roll   @relation(fields: [rollId], references: [id], onDelete: Cascade)

  name String
  // Case/whitespace-normalised, so "Riya  Sharma" collides with "riya sharma".
  nameKey String

  // Set if the guest later signs up; how attended rolls reach their home screen.
  userId String?
  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)

  tokenVersion Int      @default(0)
  createdAt    DateTime @default(now())

  photos Photo[]

  @@unique([rollId, nameKey])
  @@index([rollId])
  @@index([userId])
}

model Photo {
  id      String @id @default(cuid())
  rollId  String
  roll    Roll   @relation(fields: [rollId], references: [id], onDelete: Cascade)
  guestId String
  guest   Guest  @relation(fields: [guestId], references: [id], onDelete: Cascade)

  fullKey    String
  previewKey String
  blurData   String @db.Text

  width  Int
  height Int
  bytes  Int

  status PhotoStatus @default(PENDING)

  takenAt   DateTime @default(now())
  createdAt DateTime @default(now())

  @@index([rollId, takenAt])
  @@index([guestId])
  @@index([status, createdAt])
}

model Coupon {
  id   String  @id @default(cuid())
  code String  @unique
  note String?

  // Single use. All three are set together, in one transaction, at redemption.
  redeemedById String?
  redeemedBy   User?     @relation(fields: [redeemedById], references: [id], onDelete: SetNull)
  redeemedAt   DateTime?
  rollId       String?   @unique
  roll         Roll?     @relation(fields: [rollId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())

  @@index([redeemedById])
}
```

**Deleted:** `EventType`, `AccessStatus`, `EventStatus`, `AccessRequest`, `InviteCode`,
`User.passwordHash`, `User.accessStatus`, `Event.type`, `Event.partnerA`, `Event.partnerB`,
`Event.honoreeName`, `Event.askRelation`, `Guest.relation`, `Guest.relationSide`.

`passwordHash` goes entirely. Tests seed a user and mint a session cookie directly rather
than signing in — a password field kept "just for tests" is a backdoor with a nice name.

---

## The visibility model

The single most dangerous change in Wave 1. Today the rule is absolute: no route serves a
full image before `revealAt`, to anyone. It becomes conditional on two independent axes —
*is the roll open* and *whose photo is it* — and a bug here leaks photographs early and
breaks the one promise the product is built on.

Therefore: **one module, one function, called by every route that returns image bytes or
image URLs.** No route re-derives this.

`src/lib/roll-access.ts`:

```ts
export type RollPhase = "scheduled" | "capturing" | "closed" | "revealed";

export interface RollTimings {
  startsAt: Date;
  finishesAt: Date;
  revealAt: Date;
  revealMode: RevealMode;
  revealedEarly: boolean;
}

/** Whether photographs are legible at all. The seal, and nothing about who owns what. */
export function isOpen(roll: RollTimings, now = new Date()): boolean {
  if (roll.revealedEarly) return true;
  if (roll.revealMode === "DURING") return true;
  return now >= roll.revealAt;
}

export function rollPhase(roll: RollTimings, now = new Date()): RollPhase {
  if (isOpen(roll, now)) return "revealed";
  if (now < roll.startsAt) return "scheduled";
  if (now < roll.finishesAt) return "capturing";
  return "closed"; // shooting is over, the reveal has not landed yet
}

export type Viewer = { kind: "host" } | { kind: "guest"; guestId: string };

/**
 * The only place this decision is made.
 *
 * Sealed beats everything: before the reveal nobody sees a photograph, including the host
 * and including the person who took it. After it, `everyoneCanSee` decides whether a guest
 * sees the whole roll or only their own frames. The host always sees all of an open roll.
 */
export function canViewPhoto(
  roll: RollTimings & { everyoneCanSee: boolean },
  photo: { guestId: string },
  viewer: Viewer,
  now = new Date(),
): boolean {
  if (!isOpen(roll, now)) return false;
  if (viewer.kind === "host") return true;
  if (roll.everyoneCanSee) return true;
  return photo.guestId === viewer.guestId;
}

/** Prisma `where` for a photo list, so filtering happens in the query, not after it. */
export function visiblePhotoWhere(
  roll: { id: string; everyoneCanSee: boolean },
  viewer: Viewer,
) {
  const base = { rollId: roll.id, status: "READY" as const };
  if (viewer.kind === "host" || roll.everyoneCanSee) return base;
  return { ...base, guestId: viewer.guestId };
}
```

`revealAt` is derived on every write, never trusted from input:

```ts
export function computeRevealAt(
  finishesAt: Date,
  mode: RevealMode,
  delayHours: number,
): Date {
  if (mode === "DURING") return finishesAt;      // stored but never gates anything
  if (mode === "AFTER") return finishesAt;
  return new Date(finishesAt.getTime() + delayHours * 3_600_000);
}
```

**Required tests** (`tests/roll-access.spec.ts`, no browser, no database):
sealed rolls deny host and owner alike · `DURING` is open from creation · `revealedEarly`
overrides a future `revealAt` · after reveal with visibility off, a guest sees own and not
others' · with visibility on, a guest sees all · the host sees all of an open roll ·
`visiblePhotoWhere` and `canViewPhoto` never disagree for the same inputs.

That last one is the point: the list query and the single-photo guard are two code paths to
the same decision, and the failure mode is one of them drifting.

---

## Google sign-in

`env.google` already exists and is populated locally and on Railway. No auth library — the
session layer is provider-agnostic, so this is two route handlers.

- `GET /api/auth/google/start` — generate `state`, store it in a short-lived signed
  httpOnly cookie, redirect to Google's authorize endpoint with
  `scope=openid email profile`, `response_type=code`, `prompt=select_account`.
- `GET /api/auth/google/callback` — verify `state` matches the cookie and clear it, exchange
  the code at `https://oauth2.googleapis.com/token`, verify the returned `id_token`
  signature against Google's JWKS (`jose`'s `createRemoteJWKSet`) and check `iss`, `aud`
  and `exp`. Read `sub`, `email`, `email_verified`, `name`, `picture`. Reject unverified
  emails. Upsert the user by `googleId`, falling back to a match on `email` so the existing
  admin account adopts its Google identity instead of duplicating. Promote to `ADMIN` when
  the email matches `env.adminEmail`. Then `createHostSession(user)` and redirect to
  `/rolls`.

State verification is not optional — without it the callback is an open CSRF login endpoint.

**Deleted:** `hashPassword`, `verifyPassword`, `bcryptjs`, `src/app/(auth)/`,
`canCreateEvents`, and the access-request form and approvals queue.

---

## Routes

| Now | Wave 1 | Notes |
|---|---|---|
| `/` | `/` | Three CTAs collapse to **Get started** → `/welcome` |
| `/login`, `/signup` | **deleted** | replaced by `/welcome` |
| — | `/welcome` | Google + *Invited? Join a roll* |
| — | `/api/auth/google/start`, `/api/auth/google/callback` | |
| `/dashboard` | `/rolls` | host home |
| `/dashboard/new` | `/new/name` … `/new/guests` | six steps, draft in a layout-scoped provider |
| `/dashboard/events/[id]` | `/rolls/[id]` | roll home |
| `/dashboard/events/[id]/qr` | `/rolls/[id]/invite` | |
| — | `/rolls/[id]/people`, `/rolls/[id]/settings`, `/rolls/[id]/settings/info` | |
| `/account` | `/account` | redesigned |
| `/admin` | `/admin` | approvals queue → **coupon mint** |
| `/join`, `/join/[code]` | unchanged paths, new design | scanner + guest entry |
| `/e/[code]` | unchanged path, new design | guest camera and album |
| `/api/e/[code]/…` | `/api/r/[code]/…` | guarded by `roll-access.ts` |
| `/api/events/[id]/download` | `/api/rolls/[id]/download` | gated on `isOpen` |
| `/terms`, `/privacy` | rewritten | see below |
| `/proto/**` | **deleted** | including `tests/proto/`, `playwright.proto.config.ts` |

---

## Tasks

**T0 — Dev database.** Provision a Postgres service on Railway for development, point
`.env.local` at it, leave production's alone. Verify `railway variable list` for
`memovue-web` still shows the production URL and that memovue.com is up. *Nothing after this
touches production until T11.*

**T1 — Schema.** Rewrite `prisma/schema.prisma` to the above. `prisma migrate dev` against
the dev database. The app will not compile after this; that is expected and T2–T7 fix it.

**T2 — Access model.** `src/lib/roll-access.ts` with the tests above, written first. Delete
`src/lib/event-types.ts`. Fold `src/lib/reveal.ts` into `roll-access.ts` — one module owns
the timeline.

**T3 — Google sign-in.** The two routes, the user upsert, admin promotion. Delete
`src/app/(auth)/`, the password helpers and `bcryptjs`. Session helpers unchanged.

**T4 — Coupons.** Redemption in one transaction (`updateMany` with
`redeemedAt: null` in the `where`, so two simultaneous redemptions cannot both win).
`/admin` becomes a mint: generate a code, list codes with who redeemed each and when.

**T5 — Relocate.** Move every screen from `src/app/proto/` to its real route. Delete
`src/app/proto/`, `tests/proto/`, `playwright.proto.config.ts`, the `test:proto` script and
the `**/proto/**` entry in `playwright.config.ts`. Screens still read mock data at this
point; T6 and T7 replace it.

**T6 — Host side.** Wire `/rolls`, the six wizard steps, `/rolls/[id]` and its sheets,
`/account`. Creation validates the dates server-side (start within 2 years, finish within 2
months of start — the client clamp is a convenience, not the rule), derives `revealAt` and
`keptUntil`, and redeems the coupon in the same transaction as the insert.

**T7 — Guest side.** `/join`, `/join/[code]`, `/e/[code]` camera and album. Name-only join.
Every photo route moves to `/api/r/[code]/…` and takes its decision from `roll-access.ts`.

**T8 — Cover images.** Presets ship as gradients; uploads go to R2 under a `covers/` prefix,
processed by the existing `src/lib/image.ts` path.

**T9 — Legal.** Rewrite `/terms` and `/privacy` for what is now true (see below).

**T10 — Tests.** Rewrite `tests/journey.spec.ts` and `tests/public.spec.ts` for the new
routes and vocabulary; `global-setup.ts` seeds a user and mints a session cookie instead of
signing in with a password.

**T11 — Cutover.** *Requires explicit go-ahead.* Migrate the production database
(destructive — the demo roll and its R2 objects go), push, watch the deployment to a
terminal SUCCESS, sign in with Google on memovue.com, create a roll with a coupon, join it
from a phone, take a photo, confirm it is sealed. Then hand it over for the UI round.

---

## Legal rewrite (T9)

Thirteen statements the rework makes untrue. Rewriting, not softening:

*Privacy* — passwords hashed with bcrypt (no passwords at all now) · "whatever you tell us
in your beta access request" (table deleted) · "optionally how you know the host" (event
types gone) · "You do not get an account" for guests (optional accounts now) · **"Before the
reveal time: nobody"** (false under `DURING`) · "kept for as long as the host's account
exists. There's no expiry clock" (30 days) · "at least 30 days' notice" (impossible inside a
30-day life).

*Terms* — §1 approval-gated hosting (coupon now) · §2 password responsibility · §2 "Guests
never create accounts" · §6 "no expiry date and no countdown" · and the opening promise that
**"nobody — including the host and the photographer — can see any of them until the reveal
time"**, which `DURING` breaks.

Both documents must state the reveal as a **choice the host makes and the guest can see**,
matching what the album already displays. Retention becomes: kept 30 days after the roll
closes, with email warnings at 7 days and 1 day. `tests/public.spec.ts` asserts the old
30-days-notice sentence and will fail until it is updated — that failure is the reminder.

Their documents are used as a **coverage checklist only** — section topics, not wording.
Copying the text would be infringement, and would describe processors we do not use.

---

## Out of scope (Wave 2)

Guest account *linking* beyond the schema column (the signup banner points at `/welcome`;
attended rolls appearing on a guest's home screen is Wave 2) · retention emails and the
deletion job · the `PENDING` photo sweeper · payments · self-serve photo deletion for
guests.

## Success criteria

memovue.com serves the reviewed screens on real routes. A host signs in with Google, redeems
a coupon, creates a roll, and cannot see a photograph before the reveal unless they chose
`DURING`. A guest joins by QR with a name, shoots, and sees only what the visibility setting
allows. No route mentions film, `/proto` does not exist, and `roll-access.ts` is the only
module that decides who sees what.
