import { expect, test } from "@playwright/test";

import { forgetDraft, readDraft, writeDraft, type Draft } from "@/app/new/DraftContext";

/**
 * The half of the wizard that has to survive a refresh.
 *
 * `startsAt` and `finishesAt` are `Date`s, and JSON can only carry a date as a string. Every
 * screen after the first calls date methods on them the moment it renders, so a revival that
 * quietly hands back a string is a crash two steps away on a page nobody touched — which is
 * exactly the sort of thing a reload-only path gets to hide for months.
 */
const slot = new Map<string, string>();
globalThis.sessionStorage = {
  getItem: (key: string) => slot.get(key) ?? null,
  setItem: (key: string, value: string) => void slot.set(key, value),
  removeItem: (key: string) => void slot.delete(key),
} as unknown as Storage;

const draft: Draft = {
  name: "Sanjana & Rohan",
  startsAt: new Date("2026-11-14T12:30:00.000Z"),
  finishesAt: new Date("2026-11-15T17:30:00.000Z"),
  revealMode: "DELAY",
  delayHours: 6,
  coverPreset: 2,
  coverBlob: null,
  coverPreviewUrl: "blob:http://localhost/abcd",
  coverPicked: true,
  participantIndex: 3,
  shotIndex: 1,
  everyoneCanSee: true,
  giveawayAllowed: false,
};

test("a draft comes back off a reload as the shapes it went in as", () => {
  writeDraft(draft);
  const back = readDraft();

  expect(back?.name).toBe(draft.name);
  expect(back?.startsAt.toISOString()).toBe(draft.startsAt.toISOString());
  expect(back?.finishesAt.toISOString()).toBe(draft.finishesAt.toISOString());
  expect(back?.revealMode).toBe("DELAY");
  expect(back?.participantIndex).toBe(3);

  // The picked cover dies with the page that minted it. A dead object URL would render as a
  // broken cover, which is worse than the preset it falls back to.
  expect(back?.coverBlob).toBeNull();
  expect(back?.coverPreviewUrl).toBeNull();

  // What does survive is that there was one, which is how the roll created on the far side
  // of a sign-in knows to say its cover did not make the trip.
  expect(back?.coverPicked).toBe(true);
});

test("an empty or corrupt slot is nothing, not a crash on the way into the wizard", () => {
  forgetDraft();
  expect(readDraft()).toBeNull();

  sessionStorage.setItem("memovue.draft", "{ half a draf");
  expect(readDraft()).toBeNull();
});
