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
 * A render loop throws continuously. Five is enough to know what broke, and the sixth would
 * only be helping a broken page attack our own alerts.
 */
const CAP_PER_PAGE = 5;
let sent = 0;

export function reportClientError(message: unknown, source: string): void {
  if (typeof navigator === "undefined" || sent >= CAP_PER_PAGE) return;
  sent += 1;

  try {
    const body = JSON.stringify({
      message: String(message instanceof Error ? message.message : message).slice(0, 300),
      source,
      path: location.pathname,
    });
    navigator.sendBeacon?.("/api/log", new Blob([body], { type: "application/json" }));
  } catch {
    // Reporting a failure must never be the failure.
  }
}
