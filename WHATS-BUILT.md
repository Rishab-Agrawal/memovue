# What's built

Only the things that differ from what you asked for, or that you'd otherwise be surprised
by. Everything else works the way you'd expect.

- **Live:** https://memovue-web-production.up.railway.app
- **Repo:** https://github.com/Rishab-Agrawal/memovue (private)
- **Stack:** Next.js + Postgres on Railway, photos on Cloudflare R2

## Decisions that differ from the brief

**One time control, not two.** You described a reveal delay but no event end time. Capture
now runs from **start until reveal** — "12 hours" means guests shoot for 12 hours and then
everything opens. It removes a field, and removes a way to misconfigure an event by setting
an end time after the reveal time. There's also a **Reveal now** button for manual control.

**You can't see the photos early either.** No route serves full images before the reveal to
anyone, including you as the host, and the download is gated on it. This is stronger than
you asked for. If a host can peek, the promise being made to guests isn't true — but it
does mean you can't preview an album mid-event to check it's working. The guest count and
photo count are visible throughout, which is enough to confirm it's running.

**Invite codes, alongside the approval queue.** Your first customers are people you've
already pitched, so making them fill a form and wait is friction with no upside. Admin can
mint a code you hand over directly; the holder signs up with it and can create events
immediately. The queue stays for anyone who finds you cold.

**One session per guest name.** If a guest loses their session, "that's me, I'm on a new
phone" recovers it — and signs the old device out. So a name is only ever active on one
device, and someone taking over a name is immediately obvious to whoever owns it rather
than quietly sharing their shot quota.

**Event types changed.** "Office outing" became **Team offsite**, and I added Anniversary,
Baby shower, Graduation, Party, Trip and Festival. Which question a guest is asked depends
on the type — weddings and anniversaries ask which partner's side they're on (using the
names you enter, not "bride/groom"); birthdays, showers and graduations ask how they know
one named person; parties, offsites, trips and festivals ask nothing but a name.

**Photos survive a dying phone.** A capture is written to the phone's local storage before
any upload starts, and retries when the app reopens or the signal returns. A guest who
locks their phone mid-upload at a venue with bad wifi doesn't lose the shot, and a failed
upload can never cost them two of their shots.

## Design rules worth not undoing

The look is derived from your logo — thin orange line-work on pitch black. Three rules hold
it together, and breaking one is what makes an interface start looking generated:

1. **No cards.** Nothing gets a filled background *and* a border. Structure is hairline
   rules and space; every surface is pure black.
2. **No rounded corners.** Round is only for things that are actually circular — the
   shutter button, the logo's circles, status dots.
3. **Two colours.** Black and `#FF8C00`, with a warm off-white for text. Hierarchy is
   opacity on the off-white, not extra colours. Red appears only on destructive actions,
   because a delete button has to be distinguishable from a primary one.

Also deliberate, so it doesn't look like something's missing: **no emoji anywhere** (they
were removed from the event-type config so no screen can reintroduce them), and **no
monospace** — the numbers are the normal typeface with fixed-width figures.
