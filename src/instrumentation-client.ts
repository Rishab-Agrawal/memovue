import { isOurScript, reportClientError } from "@/lib/report";

/**
 * The net under the browser half of the app.
 *
 * Runs before React hydrates, so it catches what `error.tsx` cannot: everything thrown outside
 * a render. On this app that is most of what actually goes wrong — `getUserMedia` refusing a
 * camera, a canvas encode failing on an old phone, the upload queue rejecting mid-drain. A
 * React error boundary never sees any of it, and until now neither did we.
 */

/*
  Only what our own scripts threw.

  This listener hears everything the page hears, and a guest's phone is not a clean room: an
  extension, an injected script, a browser's own tooling. Asking where the code came from —
  `isOurScript`, in `report.ts`, where it is testable — is the whole filter, and it is a
  positive test on purpose. A rejection names no script, so it is asked what it is instead: our
  code and the browser's APIs reject with an `Error`, and a bare value is somebody else's. The
  alerts topic is the only one that interrupts anybody, so the question worth asking of
  anything headed there is "is this ours to fix", not "have we seen this particular nonsense
  before".
*/
window.addEventListener("error", (event) => {
  if (!isOurScript(event.filename)) return;
  reportClientError(event.error ?? event.message, "window");
});

window.addEventListener("unhandledrejection", (event) => {
  if (!(event.reason instanceof Error)) return;
  reportClientError(event.reason, "promise");
});
