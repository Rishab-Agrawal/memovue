# PM fixes

Product issues found by reading the code (2026-09-04), ranked by what they cost the user.
Ten were fixed on 2026-09-05 and are struck through with a one-line note on what was done.
Each open item names where it lives so it can be picked up cold.

## P0 — breaks the promise the product is sold on

1. ~~**The shutter does not close when the event ends.**~~ **Fixed.** The camera holds a timer
   on `finishesAt` and closes itself the instant the roll ends, rather than only being refused
   entry on the next page load. The upload grace is untouched — it exists for bytes captured
   in time, and the camera is what makes sure only those exist.

2. ~~**A failed upload eats a shot, silently and permanently.**~~ **Fixed.** The queue calls
   `DELETE /photos/[id]` before dropping a photograph it has given up on, and the sweep
   releases reservations nobody came back for after seven days.

3. **Nobody is told when the album opens.** *Open, and deliberately not fixed by email.* A
   reveal is a clock reading rather than an event — `revealAt` is a column, and a date passing
   executes nothing — so mail at that moment needs a worker holding a timer. Built and then
   removed: a scheduled pass that only *notices* the reveal delivers late, which is the wrong
   product, and exact delivery is real infrastructure for a message reaching only the
   minority of guests who have accounts and already have the roll on their home screen.
   The real fix is upstream: give every guest somewhere to leave an address, then a delivery
   mechanism becomes worth building.

4. **Photos die at 30 days and only the host is warned.** Guests see a date on a screen and
   get no notice. There is no way to extend retention, and no bulk download for guests — the
   ZIP route is host-only, so a guest's only option is saving one frame at a time.

5. ~~**No way to remove a single photo, ever.**~~ **Fixed.** The host removes one from the
   viewer on their own roll screen — bytes, row, and the cached ZIP that still contained it.
   Guests deliberately cannot: un-taking a shot returns the quota and makes the roll endless.

## P1 — ruins the day of the event

6. ~~**The end time is frozen at creation.**~~ **Fixed.** Editable from settings while the roll
   is sealed. `revealAt` and `keptUntil` move with it, and `warnedAt` resets, because it
   recorded a warning about a date that no longer exists.

7. ~~**The guest cap is a wall nobody sees coming.**~~ **Fixed.** The join that fills a roll
   emails the host, and the People screen raises the limit one tier at a time.

8. ~~**The join link is a bearer token with no expiry, no rate limit, and no eviction.**~~
   **Fixed.** Rate limiting landed separately; a host can now remove a guest and everything
   they shot. Still no blocklist — a removed guest may rejoin under any free name, which is
   the right shape while the alternative is a table of banned strangers nobody maintains.

9. ~~**The wall shrinks at reveal on private rolls.**~~ **Fixed.** `visiblePhotoWhere` now
   decides the sealed grid too, so the wall a guest watches fill up is the album they end up
   with. The change was a deletion: the sealed branch is gone.

10. ~~**The host's own numbers disagree.**~~ **Fixed.** Every count a host reads is `READY`
    only. Quota still counts reservations, in `guest-context`, which is the one place it must.

## P2 — growth, lifecycle, and knowing whether any of this works

11. ~~**Zero instrumentation.**~~ **Fixed.** All three questions are now answered every
    morning in one Telegram message: invitations shown against joins, guests who used their
    whole film against guests on rolls that closed, and revealed albums that have ever been
    opened against revealed albums. Almost none of it is a counter — rolls, hosts, guests and
    photographs were already rows with a `createdAt`, so those are queried and stay correct
    about last March. Four tallies and one column cover what leaves no row at all. Errors go to
    the same group the instant they happen, from both halves of the app. The privacy page was
    rewritten in the same change rather than after it, because it had promised no analytics.

12. **An anonymous guest has one fragile way back.** The roll link plus the exact name they
    typed. Clear the browser and recovery still needs the link. No "email me my album".

13. **Nothing turns a guest into a host.** The album banner sells an account; nothing sells the
    product at the one moment someone has just enjoyed it. That is the whole loop, missing.

14. **The only email we ever send says we are about to delete things.** *Partly fixed.* A
    roll filling up now emails the host, sent by the join that fills it — a real request at
    the exact moment it becomes true, no schedule involved. That is the shape every future
    message has to fit: something a person cannot find out by looking, at a moment some
    request already knows about. Reveal and roll-closed do not fit it (see #3). Roll created
    and first guest joined are things the host already knows, so they never will.

15. **Early scanners are turned away empty-handed.** "This roll hasn't opened yet", with no
    reminder capture and no reason to return.

## Deliberate — resist "fixing" these

- The host waiting with everyone else. It is the product, not an oversight.
- The 24h upload grace. It exists because refusing late bytes destroyed real photographs. The
  shutter closing is what bounds it; narrowing the window is not.
- No shot-count upsell mid-roll. Raising it retroactively changes what guests were promised.
- Raising the guest cap is free, because a roll is free while `BETA`. Whatever takes payments
  has to come through `raiseGuestCap`.
