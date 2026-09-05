import type { Instrumentation } from "next";

/**
 * Every server exception in the application, in one place.
 *
 * Next calls this for anything thrown out of a render, a route handler or a server action, so
 * there is nothing to remember at the call sites and no way for a new route to be added
 * unwatched. Before this, a crash went to stdout on Railway — which nobody is reading at nine
 * on a Saturday evening, which is exactly when a wedding is happening.
 *
 * The digest is carried into the message deliberately. It is the same string `error.tsx`
 * prints on the screen the guest is looking at, so a photograph of a phone and a line on a
 * lock screen name the same failure, and nobody has to describe a blank page.
 */

/** Control flow, not failure: `redirect()` and `notFound()` are thrown to unwind the render. */
const FRAMEWORK = /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK|DYNAMIC_SERVER_USAGE)/;

function isFramework(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { digest, message } = error as { digest?: unknown; message?: unknown };
  return (
    (typeof digest === "string" && FRAMEWORK.test(digest)) ||
    (typeof message === "string" && FRAMEWORK.test(message))
  );
}

/**
 * What makes two crashes the same crash.
 *
 * The route rather than the URL, so five hundred guests hitting one broken page are one fault
 * and not five hundred: `/join/[code]` is the thing that is broken, `/join/K3F9QA` is only who
 * found out. The message is trimmed to its first line and cut short because a stack frame or
 * a row id inside it would make every occurrence unique, which is the same as no deduplication
 * at all.
 */
export function fingerprint(routePath: string, message: string): string {
  return `${routePath}|${message.split("\n", 1)[0].slice(0, 120)}`;
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (isFramework(error)) return;

  const message = error instanceof Error ? error.message : String(error);
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest?: unknown }).digest)
      : undefined;

  // Imported here rather than at the top of the file: this module is loaded while the server
  // is still starting up, and neither the database client nor the configuration should be
  // pulled in for a request that never fails.
  const [{ record }, { alert }] = await Promise.all([
    import("./lib/metrics"),
    import("./lib/telegram"),
  ]);

  await Promise.all([
    record("server_error"),
    alert(
      fingerprint(context.routePath, message),
      [
        `Server error — ${context.routePath || request.path}`,
        `${request.method} ${request.path} · ${context.routeType}`,
        "",
        message,
        digest ? `digest ${digest}` : null,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    ),
  ]);
};
