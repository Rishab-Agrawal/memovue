import { expect, test } from "@playwright/test";

import { shareOrCopy } from "../../src/lib/share";

/**
 * The share sheet is the whole point on a phone and absent everywhere else, so the fallback
 * is not an edge case — it is what half the people pressing the button will get. What matters
 * is that the answer coming back is honest: the button says "Copied" only when it copied.
 */
const link = { url: "https://cdn.example/photo.jpg" };

function nav(share: null | (() => Promise<void>), write?: () => Promise<void>) {
  return {
    share: share ?? undefined,
    clipboard: { writeText: write ?? (async () => {}) },
  } as unknown as Pick<Navigator, "share" | "clipboard">;
}

const refuse = async () => {
  throw new Error("refused");
};

test.describe("sharing a link", () => {
  test("uses the share sheet where there is one", async () => {
    let shared: unknown = null;
    expect(
      await shareOrCopy(link, nav(async () => {
        shared = link;
      })),
    ).toBe("shared");
    expect(shared).toEqual(link);
  });

  test("falls back to the clipboard where there is not", async () => {
    expect(await shareOrCopy(link, nav(null))).toBe("copied");
  });

  test("falls back to the clipboard when the sheet is dismissed", async () => {
    let copied = "";
    const write = async () => {
      copied = link.url;
    };
    expect(await shareOrCopy(link, nav(refuse, write))).toBe("copied");
    expect(copied).toBe(link.url);
  });

  test("admits it when neither worked", async () => {
    expect(await shareOrCopy(link, nav(refuse, refuse))).toBeNull();
  });
});
