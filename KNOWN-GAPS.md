# Known gaps

Things that are deliberately missing or incomplete, and what would break because of them.
Captured 2 August 2026. Ordered roughly by how much they'd hurt.

## 1. No password reset

A host who forgets their password has no way back in — there's no "forgot password" flow,
and no admin UI for resetting one. Recovering an account currently means editing the
database by hand.

**Blocks:** letting real hosts sign up without hand-holding.
**Unblocked:** this used to be waiting on email. Resend is live and verified now, so the
reset flow can be built whenever you want it.

## 2. Failed uploads can permanently eat a shot

When a guest taps "Keep it", the server reserves a `PENDING` photo row before any bytes are
uploaded. That reservation is what stops one photo costing two shots. But if the upload
never completes *and* the guest clears their browser, the queue entry is gone while the
`PENDING` row survives — and it still counts against their quota forever.

The schema was designed for a sweeper (there's an index on `[status, createdAt]` for exactly
this), **but the sweeper was never written.** The comment on the `Photo.status` field in
`prisma/schema.prisma` currently claims stale rows are swept — that comment is aspirational
and should be corrected or made true.

**Fix:** a periodic job deleting `PENDING` photos older than ~1 hour, plus their R2 objects.
Small, and worth doing before a 500-guest event.

## 3. Guests can't delete their own photos in the app

The privacy policy routes this through email (`hello@memovue.com`), which is honest but
manual. Guests own the copyright in their photos and have a right to erasure, so the
self-serve version is the correct end state.

**Fix:** a delete control in the full-screen viewer, visible only on your own photos, that
removes the row and both R2 objects.

## 4. Retention notices are entirely manual

The promise in the terms is that a host gets **at least 30 days' notice by email** before
any album is deleted. The pieces exist — `Event.deletionNoticeAt` in the schema and
`sendDeletionNotice()` in `src/lib/email.ts` — but **nothing calls them.** There is no
scheduled job, and no admin UI for triggering a notice.

Right now that promise is kept by remembering to keep it. That's fine at current scale and
becomes a liability the moment it isn't.

## 5. Rate limiting is in-process

`src/lib/ratelimit.ts` uses an in-memory Map. Correct and cheap for one Railway container;
the limits silently become per-replica the moment there's more than one.

**Fix when scaling:** swap the Map for Redis. The call sites don't change.

## 6. Events can't be edited after creation

No way to fix a typo in the event name, adjust the start time, or raise the guest cap. The
only remedy is deleting and recreating, which invalidates the QR code — bad if it's already
printed.

**Fix:** an edit form for the safe fields (name, guest cap, reveal delay). Start time and
event type are riskier once guests have joined.

## 7. Guests have no cross-event view

A guest session is scoped to one event via one cookie. There's no "my events" screen, so
someone who's been to three events needs three links. Acceptable — the QR is the entry
point by design — but worth knowing.

## 8. ZIP download is one long request

The host's download streams every photo through the server in a single response. It's
memory-safe (one photo at a time, no compression) and Railway has no request timeout, but a
dropped connection at 90% means starting over. At 12,500 photos that's a real risk.

**Fix if it bites:** batch into multiple ZIPs, or generate one to R2 in the background and
email a link.

## Not gaps — deliberate

- **No analytics or tracking.** Stated in the privacy policy; keep it that way.
- **Dark theme only.** A committed aesthetic, not an oversight.
- **Guests get no account.** The QR is the whole onboarding; adding auth would defeat it.
- **The host can't see photos early.** The entire product promise depends on this.
