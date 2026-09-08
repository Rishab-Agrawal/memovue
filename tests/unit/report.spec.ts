import { expect, test } from "@playwright/test";

/**
 * What the browser is allowed to wake somebody up about.
 *
 * The alerts topic is the only one that buzzes a phone, so the cost of a false one is that the
 * true ones stop being read. Two kinds of message got through and neither was a fault:
 * `NEXT_REDIRECT`, which is how `redirect()` navigates, and `[object Object]`, which is what
 * `String()` makes of a rejection carrying anything useful.
 *
 * `report.ts` reads `navigator` and `location`, so both are stood up before it is imported.
 * One test, because the module counts to five and then stops on purpose.
 */
test("the browser reports faults, and only faults", async () => {
  const beacons: Blob[] = [];

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { sendBeacon: (_url: string, blob: Blob) => Boolean(beacons.push(blob)) },
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { pathname: "/rolls/abc/settings" },
  });

  const { reportClientError } = await import("@/lib/report");

  // How a server action that ends in `redirect()` rejects in the browser: deleting a roll,
  // signing out, closing an account. The router is already doing as it was told.
  reportClientError(
    Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/rolls;307;" }),
    "promise",
  );

  // `error.tsx` reports the digest rather than the error, so a bare string arrives here too.
  reportClientError("NEXT_NOT_FOUND", "boundary");

  expect(beacons).toHaveLength(0);

  // A real one still gets through, which is the entire point of the file.
  reportClientError(new Error("canvas encode failed"), "window");

  // And a rejection carrying an object is worth reading rather than "[object Object]".
  reportClientError({ code: 413, key: "roll/abc/9.jpg" }, "promise");

  const sent = await Promise.all(beacons.map((blob) => blob.text()));

  expect(sent).toHaveLength(2);
  expect(JSON.parse(sent[0])).toMatchObject({
    message: "canvas encode failed",
    source: "window",
    path: "/rolls/abc/settings",
  });
  expect(JSON.parse(sent[1]).message).toBe('{"code":413,"key":"roll/abc/9.jpg"}');
});
