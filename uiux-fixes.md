# UI/UX issues found — all fixed

Same spirit as the settings-panel bug: things that were attached to the wrong thing,
fell off the edge of the screen, or quietly did nothing. Worst first inside each group.
Each point says what a person actually saw, then where it lived.

**Every one of these was fixed on 2026-09-05.** Kept as the record of what was wrong and
where, not as an open list.

---

## 1. Same family as the bug you just fixed

**The screen behind a pop-up still scrolls.**
Open Settings, Invite, People, the time picker or a photo, then swipe up or down on the
dimmed area — the roll behind it scrolls away underneath. Close it and you are somewhere
else on the page than where you started. Nothing anywhere stops the background moving.
→ `Sheet.tsx`, `Dialog.tsx`, `TimeWheel.tsx`, `PhotoViewer.tsx`

**The Next button in "create a roll" sits at a different height on every step.**
It is meant to sit at the bottom of the screen but is pinned to the bottom of the
*content* instead. On "What is the name of your event?" it lands mid-screen with a large
empty gap under it; on the busier steps it is near the bottom. So it moves under your
thumb as you go through the flow.
→ `WizardShell.tsx` (the full-height rule it asks for never takes effect)

---

## 2. Things sitting under the phone's own bars

The stylesheet already has ready-made spacers for this (`pad-safe-bottom`,
`pad-safe-top`) and **nothing in the app uses them.**

**The shutter button sits on the iPhone home bar.**
The camera leaves a fixed 32px gap at the bottom; the home-swipe strip is about 34px.
The single most important tap in the product is in the one place the phone steals
touches from.
→ `CameraView.tsx`

**Same for the bottom bar on Home and Settings.** The two icons end right at the home bar.
→ `BottomNav.tsx`

**Same for the bottom of every slide-up panel.** The last person in the People list, the
Delete button in Roll Settings, and "Save QR image" all end inside that strip.
→ `Sheet.tsx`

**The back arrow and the gear on a roll sit under the notch.** Only when the app is added
to the home screen, which is exactly how guests are told to use it.
→ `RollHeader.tsx`

---

## 3. Buttons that don't do what they say

**Cancel on "Delete this roll?" doesn't close the box.**
It reloads the screen behind the confirmation and leaves the confirmation sitting there.
Every other Cancel in the app is a plain button; this one is a link pointing at the page
it is already on.
→ `SettingsSheet.tsx`

**The greyed-out download button says nothing when tapped.**
The greyed-out camera right beside it explains itself ("That's all your shots"), so one
dead button teaches you to expect an answer and the other one ignores you.
→ `RollParts.tsx`

**Tapping Save on a finished album looks like nothing happened.**
A big album is built on the spot and can take minutes — no spinner, no "preparing your
album", no progress. If it fails or you have downloaded it too often, you land on a page
of raw code instead of a message.
→ `RollParts.tsx` → `api/rolls/[id]/download`

**"Instagram" in Settings goes to Instagram's front page, in the same tab.** The app is
gone and the only way back is the browser's back button.
→ `AccountScreen.tsx`

---

## 4. No way out, no way back

**Deny the camera once and the screen is dead.** A line of text, no "Try again", no note
saying you have to turn it back on in your phone's own settings.
→ `CameraView.tsx`

**Reloading mid-way through creating a roll wipes everything.**
Nothing you typed is kept anywhere, so a refresh, a phone call, or coming back an hour
later drops you on the last step with a greyed-out Create button that never says why
(it is waiting on the event name from step one, which is no longer on screen).
→ `DraftContext.tsx`

**Changing the roll name and hitting back throws it away silently.** No warning, no
"you have unsaved changes".
→ `EditInfoForm.tsx`

**Editing your own name in Settings has no Cancel.** Once you tap the name, Save is the
only way out — and pressing Enter/Go on the phone keyboard does nothing.
→ `AccountScreen.tsx`

**Confirmation boxes and the time picker can only be closed by finding the right button.**
Tapping outside them does nothing, and Escape on a keyboard does nothing. The slide-up
panels do both correctly, so the app is inconsistent with itself.
→ `Dialog.tsx`, `TimeWheel.tsx`

**Pressing Enter never moves you forward.** Not on the event name, not on the roll title,
not on your own name. Every field needs the keyboard dismissed first to reach a button.
→ `new/name`, `settings/info`, `account`

---

## 5. Things that don't fit the screen

**"Choose your cover" is taller than a small phone and cannot be scrolled.** The row of
preset covers and the Done button are cut off with no way to reach them.
→ `Dialog.tsx` has no height limit — `new/card` is where it bites

**Turn the phone sideways in the camera and the shutter falls off the bottom.** Same on a
small phone in normal orientation. There is nothing to scroll to get it back.
→ `CameraView.tsx`

---

## 6. Things that move while you're looking at them

**A locked roll's wall reloads itself every 20 seconds.**
Every time anyone else takes a photo, the grid is thrown away and rebuilt from the top —
so if you had scrolled down through a few hundred frames, you are back near the start.
→ `AlbumView.tsx`

**The album shows a bare "Loading…" line first.** No cover, no title, no placeholder
frames — on a slow connection it reads as broken rather than as loading.
→ `AlbumView.tsx`

---

## 7. Built, then never wired up

**The reveal — the moment the whole product exists for — happens as a plain page refresh.**
A "seal breaking" animation was written and is not used by anything. Neither is the
"photo developing out of blur" fade, nor the placeholder tiles for a grid that hasn't
arrived yet.
→ `globals.css`: `animate-unseal`, `animate-develop`, `animate-wait`, `mv-breathe`

---

## 8. Small, but plainly wrong

**The People panel always says "3 of 3 joined so far".** It compares the number who joined
against itself instead of against the guest limit the roll was set up for, so the line
tells the host nothing.
→ `people/page.tsx`

**"Roll Created!" prints the join link as plain text with nothing to copy it with**, even
though a working Share button already exists one screen away.
→ `new/guests`, and `ShareLink.tsx` is the thing it should use

**The flash button shows the same crossed-out icon whether flash is on or off.** Only a
colour change tells you, which is invisible in a dark room at arm's length.
→ `CameraView.tsx`

**The + and − for the reveal delay stay looking tappable after you hit the limit.** They
simply stop responding.
→ `new/reveal`

**In the date picker you can page forward into months where every single day is greyed
out**, with nothing saying you have gone past what is allowed.
→ `Calendar.tsx`
