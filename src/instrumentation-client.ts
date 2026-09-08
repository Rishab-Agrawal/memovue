import { reportClientError } from "@/lib/report";

/**
 * The net under the browser half of the app.
 *
 * Runs before React hydrates, so it catches what `error.tsx` cannot: everything thrown outside
 * a render. On this app that is most of what actually goes wrong — `getUserMedia` refusing a
 * camera, a canvas encode failing on an old phone, the upload queue rejecting mid-drain. A
 * React error boundary never sees any of it, and until now neither did we.
 */

/**
 * Somebody else's script, thrown over the same wall.
 *
 * A script from another origin — an extension on a guest's phone, most of them — is blanked
 * by the browser before we see it: no error object, no filename, no line, and the literal
 * message "Script error.". There is nothing there to fix and nothing there of ours, so it is
 * the one thing that reaches this listener and must not reach the alerts channel. The empty
 * `filename` is the browser saying so, which is sturdier than matching on the string.
 */
const isOpaque = (event: ErrorEvent): boolean => !event.error && !event.filename;

window.addEventListener("error", (event) => {
  if (isOpaque(event)) return;
  reportClientError(event.error ?? event.message, "window");
});

window.addEventListener("unhandledrejection", (event) => {
  reportClientError(event.reason, "promise");
});
