import type { Instrumentation } from "next";

import { serverFault } from "./lib/alert-text";

/**
 * Every server exception, reported in one place: Next calls this for anything thrown from a
 * render, route handler or server action. The digest matches the code `error.tsx` shows the user.
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
 * What makes two crashes the same: the route pattern (not the URL) and the message's first line,
 * trimmed so ids and stack frames do not make every occurrence unique.
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

  // Lazy imports: this module loads at startup, and a request that never fails needs neither.
  const [{ record }, { alert }] = await Promise.all([
    import("./lib/metrics"),
    import("./lib/telegram"),
  ]);

  await Promise.all([
    record("server_error"),
    alert(
      fingerprint(context.routePath, message),
      serverFault({
        route: context.routePath || request.path,
        routeType: context.routeType,
        request: `${request.method} ${request.path}`,
        message,
        digest,
      }),
    ),
  ]);
};
