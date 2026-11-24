import { expect, test } from "@playwright/test";

import { savePngToPhotos, shareOrCopy } from "../../src/lib/share";

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

test.describe("saving the QR to Photos", () => {
  const png = "data:image/png;base64,iVBORw0KGgo=";
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
  const ipad = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
  const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0";

  function device(userAgent: string, maxTouchPoints = 5) {
    const shared: File[] = [];
    const nav = {
      userAgent,
      maxTouchPoints,
      canShare: () => true,
      share: async (data: ShareData) => {
        shared.push(...(data.files ?? []));
      },
    } as unknown as Pick<Navigator, "share" | "canShare" | "userAgent" | "maxTouchPoints">;
    return { nav, shared };
  }

  test("an iPhone gets the share sheet, holding the PNG itself", async () => {
    const { nav, shared } = device(iphone);
    expect(savePngToPhotos(png, "memovue-ABC.png", nav)).toBe(true);

    expect(shared).toHaveLength(1);
    expect(shared[0].name).toBe("memovue-ABC.png");
    expect(shared[0].type).toBe("image/png");
    expect([...new Uint8Array(await shared[0].arrayBuffer())]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  test("an iPad asking for the desktop site is still an iPad", () => {
    expect(savePngToPhotos(png, "q.png", device(ipad).nav)).toBe(true);
  });

  test("a Mac, and Android, keep the download", () => {
    expect(savePngToPhotos(png, "q.png", device(ipad, 0).nav)).toBe(false);
    const { nav, shared } = device(android);
    expect(savePngToPhotos(png, "q.png", nav)).toBe(false);
    expect(shared).toHaveLength(0);
  });
});
