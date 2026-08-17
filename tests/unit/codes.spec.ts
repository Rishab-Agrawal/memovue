import { expect, test } from "@playwright/test";

import { extractJoinCode, normalizeCode, rollCode } from "@/lib/codes";

/**
 * `extractJoinCode` is what stands between a scanned QR and a navigation.
 *
 * It has two jobs, and the second one is the reason it exists at all. It has to recognise an
 * invitation in whatever shape it arrives — scanned, pasted, or typed off a printed card. And
 * it has to refuse everything else, because the scanner points at whatever sticker is on the
 * table and the alternative to refusing is following it.
 */
test.describe("recognising an invitation", () => {
  test("takes a bare code, in any case or spacing", () => {
    expect(extractJoinCode("K7QM2P")).toBe("K7QM2P");
    expect(extractJoinCode("k7qm2p")).toBe("K7QM2P");
    expect(extractJoinCode("  K7QM-2P  ")).toBe("K7QM2P");
  });

  test("takes the code out of a full invitation link", () => {
    expect(extractJoinCode("https://memovue.com/join/K7QM2P")).toBe("K7QM2P");
    expect(extractJoinCode("memovue.com/join/K7QM2P")).toBe("K7QM2P");
    // The camera route identifies the same roll, and gets shared just as often.
    expect(extractJoinCode("https://memovue.com/e/K7QM2P")).toBe("K7QM2P");
  });

  test("survives the query strings that messaging apps staple on", () => {
    // The previous implementation split on `?` and took the last piece, so a forwarded link
    // resolved to its tracking parameter and the guest was told their invitation was invalid.
    expect(extractJoinCode("https://memovue.com/join/K7QM2P?utm_source=whatsapp")).toBe("K7QM2P");
    expect(extractJoinCode("https://memovue.com/join/K7QM2P#top")).toBe("K7QM2P");
    expect(extractJoinCode("https://memovue.com/join/K7QM2P/")).toBe("K7QM2P");
  });

  test("refuses anything that is not a code", () => {
    expect(extractJoinCode("")).toBeNull();
    expect(extractJoinCode("   ")).toBeNull();
    expect(extractJoinCode("K7QM")).toBeNull();
    expect(extractJoinCode("K7QM2PXX")).toBeNull();
    // Characters we never print, because they are misread off a card.
    expect(extractJoinCode("K7QM2O")).toBeNull();
    expect(extractJoinCode("K7QM2I")).toBeNull();
    expect(extractJoinCode("K7QM21")).toBeNull();
  });

  /**
   * The scanner reads whatever is held up to it. A wifi QR, a payment QR, or a link to
   * somewhere hostile all arrive through the same callback as a real invitation.
   */
  test("refuses the other QR codes on the table", () => {
    expect(extractJoinCode("WIFI:S:VenueGuest;T:WPA;P:hunter2;;")).toBeNull();
    expect(extractJoinCode("https://example.com/")).toBeNull();
    expect(extractJoinCode("https://evil.example/join/../../steal")).toBeNull();
    expect(extractJoinCode("javascript:alert(1)")).toBeNull();
    expect(extractJoinCode("tel:+919999999999")).toBeNull();
  });

  test("accepts every code the generator can produce", () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const code = rollCode();
      expect(extractJoinCode(code)).toBe(code);
      expect(extractJoinCode(`https://memovue.com/join/${code}`)).toBe(code);
    }
  });

  test("agrees with normalizeCode on what a code looks like", () => {
    const code = rollCode();
    expect(extractJoinCode(code.toLowerCase())).toBe(normalizeCode(code));
  });
});
