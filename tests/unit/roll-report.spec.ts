import { expect, test } from "@playwright/test";

import { fromWall } from "@/lib/format";
import { chunk, describeDeleted, describeHosts, describeRoll, type RollReport } from "@/lib/roll-report";

const roll: RollReport = {
  name: "Sunday lunch",
  createdAt: fromWall(2026, 8, 10, 9, 30),
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
const during = fromWall(2026, 8, 19, 20, 0);

test("a started roll counts the host's shots but not the host as a guest", () => {
  expect(describeRoll(roll, during)).toBe(
    [
      "Sunday lunch",
      "Created 10 Sep 2026 at 9:30 am",
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

test("the copy kept after deletion names nobody", () => {
  const kept = describeRoll(roll, during, false);

  expect(kept).toContain("  Host — 3\n  Guest 1 — 10");
  expect(kept).not.toMatch(/Riya|Kabir/);
  expect(describeDeleted({ summary: kept, deletedAt: during, deletedBy: "EXPIRY" })).toMatch(
    /^DELETED 19 Sep 2026 at 8:00 pm, expired, 30 days after it ended\n\nSunday lunch\n/,
  );
});

test("an unstarted roll says so instead of counting", () => {
  expect(describeRoll(roll, fromWall(2026, 8, 12)).endsWith("\n\nNot started yet.")).toBe(true);
});

test("hosts are listed latest roll first, and people with none last as new", () => {
  expect(
    describeHosts([
      { email: "never@x.com", rolls: 0, latest: null },
      { email: "old@x.com", rolls: 0, latest: fromWall(2026, 7, 1, 10, 0) },
      { email: "recent@x.com", rolls: 2, latest: fromWall(2026, 8, 10, 9, 30) },
    ]),
  ).toBe(
    [
      "recent@x.com — 2 (10 Sep 2026 at 9:30 am)",
      "old@x.com — 0 (1 Aug 2026 at 10:00 am)",
      "never@x.com — 0 (new)",
    ].join("\n"),
  );
});

test("a long reply splits on line breaks, under Telegram's limit", () => {
  const text = Array.from({ length: 500 }, (_, i) => `  Guest ${i} — 24`).join("\n");
  const parts = chunk(text);

  expect(parts.length).toBeGreaterThan(1);
  expect(parts.every((part) => part.length <= 4096)).toBe(true);
  expect(parts.join("\n")).toBe(text);
});
