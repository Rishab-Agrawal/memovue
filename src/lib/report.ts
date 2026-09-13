/**
 * A crash in somebody's browser, told to the server. `sendBeacon` rather than `fetch`, because
 * a beacon survives the page unloading.
 */

/**
 * Whether the script that threw is one of ours. A positive test on our origin, rather than a
 * growing list of extension and cross-origin noise nobody here could fix.
 */
export function isOurScript(filename: string): boolean {
  return filename.startsWith(`${location.origin}/`);
}

/** A render loop throws continuously; five reports are enough to know what broke. */
const CAP_PER_PAGE = 5;
let sent = 0;

/**
 * `redirect()` and `notFound()` work by throwing, so they are navigation, not faults. Matched on
 * the value too, because `error.tsx` reports a bare digest string.
 */
const isControlFlow = (error: unknown): boolean => {
  const digest = (error as { digest?: unknown } | null)?.digest;
  const message = (error as { message?: unknown } | null)?.message;
  return [digest, message, error].some((v) => typeof v === "string" && v.startsWith("NEXT_"));
};

/** A thrown non-Error as readable text rather than `[object Object]`. */
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
