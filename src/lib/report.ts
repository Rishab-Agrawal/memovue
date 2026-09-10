/**
 * A crash in somebody's browser, told to the server.
 *
 * The half of the app that breaks in ways nobody hears about is this one: the camera runs on
 * a stranger's phone, on a browser we did not choose, at a wedding we are not at. `error.tsx`
 * used to be the whole story and it only ever wrote to a console nobody was going to open.
 *
 * `sendBeacon` rather than `fetch`, because the interesting failures are the ones that happen
 * while the page is going away — a beacon is queued by the browser and survives the unload,
 * a fetch is cancelled with it.
 */

/**
 * Whether the script that threw is one of ours.
 *
 * A guest's phone runs a great deal more code than this app ships. An extension throws with a
 * `chrome-extension://` filename; a script from another origin is blanked by the browser
 * before we see it — no error object, no filename, no line, and the literal message "Script
 * error."; a synthesised `ErrorEvent` names no source at all. None of those is anything
 * anybody here can fix, and none can be read by somebody woken at midnight by it.
 *
 * A positive test rather than a list of the junk seen so far, because such a list only ever
 * grows and every entry on it is written the morning after a message nobody could make sense
 * of. Our own chunks are served from the origin the page was, and so is the document an
 * inline script lives in. Anything else is not ours to report.
 */
export function isOurScript(filename: string): boolean {
  return filename.startsWith(`${location.origin}/`);
}

/**
 * A render loop throws continuously. Five is enough to know what broke, and the sixth would
 * only be helping a broken page attack our own alerts.
 */
const CAP_PER_PAGE = 5;
let sent = 0;

/**
 * How Next says "navigate", not "broken".
 *
 * `redirect()` and `notFound()` work by throwing, so a server action that ends in one rejects
 * its promise in the browser too — deleting a roll, signing out, closing an account. Nothing
 * went wrong; the router is already doing as it was told. An alerts channel that cries
 * NEXT_REDIRECT every time somebody signs out is a channel nobody reads.
 *
 * The same list the server keeps in `instrumentation.ts`, minus the ones only a render can
 * throw. Matched on the value itself as well as its fields, because `error.tsx` reports a
 * digest — a bare string — rather than the error it came from.
 */
const isControlFlow = (error: unknown): boolean => {
  const digest = (error as { digest?: unknown } | null)?.digest;
  const message = (error as { message?: unknown } | null)?.message;
  return [digest, message, error].some((v) => typeof v === "string" && v.startsWith("NEXT_"));
};

/**
 * What to put in the message, when the thing thrown is not an `Error`.
 *
 * `String()` on an object is `[object Object]`, which wakes a phone to say nothing at all.
 * A rejection carrying `{ code: 413, key: "…" }` is worth reading, so serialise it; anything
 * circular or otherwise hostile falls back to what we had.
 */
const describe = (value: unknown): string => {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

export function reportClientError(message: unknown, source: string): void {
  if (typeof navigator === "undefined" || sent >= CAP_PER_PAGE) return;
  if (isControlFlow(message)) return;
  sent += 1;

  try {
    const body = JSON.stringify({
      message: describe(message).slice(0, 300),
      source,
      path: location.pathname,
    });
    navigator.sendBeacon?.("/api/log", new Blob([body], { type: "application/json" }));
  } catch {
    // Reporting a failure must never be the failure.
  }
}
