import { PARTICIPANT_TIERS, SHOT_TIERS, type RevealMode } from "./rules";

/**
 * Every piece of fake data the prototype shows. One file on purpose: changing a name, a
 * count or a date is a one-line edit here rather than a hunt through screens.
 *
 * Times are fixed rather than relative to the real clock so the prototype renders the same
 * countdown on every run and screenshots stay comparable.
 */

export const NOW = new Date("2026-09-12T22:10:00+05:30");

export const HOST = { name: "Rishab Agrawal", initials: "RA", firstName: "Rishab" };

export const FILM = {
  title: "Aarav & Diya's Wedding",
  code: "K7M2XQP9",
  joinUrl: "https://memovue.com/f/K7M2XQP9",
  startAt: new Date("2026-09-12T18:00:00+05:30"),
  finishAt: new Date("2026-09-13T23:00:00+05:30"),
  revealMode: "after" as RevealMode,
  revealDelayHours: 12,
  participantIndex: 3, // 50
  shotIndex: 3, // 24
  everyoneCanSee: false,
  moments: 2,
  people: 2,
  keptUntil: new Date("2026-10-13T23:00:00+05:30"),
};

export const PARTICIPANT_CAP = PARTICIPANT_TIERS[FILM.participantIndex];
export const SHOTS_PER_PERSON = SHOT_TIERS[FILM.shotIndex];

/** Newest first, which is the order the album renders in. */
export const PHOTOS = [
  { id: "p4", by: "Meera", takenAt: new Date("2026-09-12T21:58:00+05:30"), plate: 3 },
  { id: "p3", by: "You", takenAt: new Date("2026-09-12T21:31:00+05:30"), plate: 1 },
  { id: "p2", by: "You", takenAt: new Date("2026-09-12T20:14:00+05:30"), plate: 4 },
  { id: "p1", by: "Meera", takenAt: new Date("2026-09-12T19:02:00+05:30"), plate: 2 },
];

export const PEOPLE = [
  { name: "You", shotsUsed: 2 },
  { name: "Meera", shotsUsed: 2 },
];

/** Indices into the Plate component's gradient set. */
export const COVER_PRESETS = [0, 1, 2, 3, 4];

/** The one code that works in the prototype. Everything else is rejected. */
export const COUPON = "MEMOVUE100";

/** The finished album shown under ALBUMS on the home screen. */
export const PAST_ALBUM = {
  title: "Diwali at Meera's",
  from: new Date("2026-08-08T19:00:00+05:30"),
  to: new Date("2026-08-09T02:00:00+05:30"),
  plates: [0, 2, 4, 1],
};
