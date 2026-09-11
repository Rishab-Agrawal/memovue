import { expect, test } from "@playwright/test";

import { fromWall } from "@/lib/format";
import { chunk, describeRoll, type RollReport } from "@/lib/roll-report";

const roll: RollReport = {
  name: "Riya's wedding",
  startsAt: fromWall(2026, 8, 19, 18, 0),
  finishesAt: fromWall(2026, 8, 20, 2, 0),
  revealMode: "DELAY",
  revealDelayHours: 6,
  revealedEarly: false,
  maxGuests: 50,
  photosPerGuest: 24,
  hostId: "host",
  guests: [
    { name: "Riya", userId: "host", _count: { photos: 3 } },
    { name: "Kabir", userId: null, _count: { photos: 10 } },
  ],
};

test("a started roll counts the host's shots but not the host as a guest", () => {
  expect(describeRoll(roll, fromWall(2026, 8, 19, 20, 0))).toBe(
    [
      "Riya's wedding",
      "Starts 19 Sep 2026 at 6:00 pm",
      "Ends 20 Sep 2026 at 2:00 am",
      "Reveals 6h after the event",
      "Up to 50 guests · 24 shots each",
      "",
      "13 shots · 1 guests joined",
      "  Riya (host) — 3",
      "  Kabir — 10",
    ].join("\n"),
  );
});

test("an unstarted roll says so instead of counting", () => {
  expect(describeRoll(roll, fromWall(2026, 8, 1)).endsWith("\n\nNot started yet.")).toBe(true);
});

test("a long reply splits on line breaks, under Telegram's limit", () => {
  const text = Array.from({ length: 500 }, (_, i) => `  Guest ${i} — 24`).join("\n");
  const parts = chunk(text);

  expect(parts.length).toBeGreaterThan(1);
  expect(parts.every((part) => part.length <= 4096)).toBe(true);
  expect(parts.join("\n")).toBe(text);
});
