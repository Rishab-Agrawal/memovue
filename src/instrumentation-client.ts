import { reportClientError } from "@/lib/report";

/**
 * The net under the browser half of the app.
 *
 * Runs before React hydrates, so it catches what `error.tsx` cannot: everything thrown outside
 * a render. On this app that is most of what actually goes wrong — `getUserMedia` refusing a
 * camera, a canvas encode failing on an old phone, the upload queue rejecting mid-drain. A
 * React error boundary never sees any of it, and until now neither did we.
 */
window.addEventListener("error", (event) => {
  reportClientError(event.error ?? event.message, "window");
});

window.addEventListener("unhandledrejection", (event) => {
  reportClientError(event.reason, "promise");
});
