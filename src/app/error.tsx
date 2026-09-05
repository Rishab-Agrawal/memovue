"use client";

import { useEffect } from "react";

import { Pill, PillLink } from "@/components/roll/Chrome";
import { reportClientError } from "@/lib/report";

/**
 * What a crash looks like, instead of what it looked like.
 *
 * Without this file an uncaught exception anywhere below the root layout renders Next's own
 * fallback: a bare white page reading "Application error: a server-side exception has
 * occurred". On a phone at a wedding, mid-upload, that is indistinguishable from the app
 * being gone — and there was nothing on it to tap, so the photographs sitting in the queue
 * looked lost too. They are not: the queue is in IndexedDB and drains on the next open, which
 * is exactly what the retry below does.
 *
 * `unstable_retry` rather than `reset`: the former re-fetches the segment, which is what a
 * failed database read actually needs. `reset` only re-renders what it already has.
 *
 * The digest is printed on purpose. It is the only string that ties what somebody is looking
 * at to a line in the server log, and asking a guest to describe a blank screen instead is
 * how a bug survives a whole event.
 *
 * It is also reported, because this boundary is the one place a crash is *not* seen by the
 * global handlers in `instrumentation-client`: React catches a failed render before it ever
 * reaches `window`. A server error arrives here already stripped to its digest and is
 * announced from `onRequestError` with its message intact, so what this adds is the
 * client-side half — the render that only breaks on somebody else's phone.
 */
export default function ErrorScreen({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
    reportClientError(error.digest ?? error, "boundary");
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="display text-[28px] text-chalk">Something went wrong</h1>
      <p className="max-w-xs text-[15px] text-ash">
        Nothing you shot is lost — photos wait on your phone until they can be sent.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <Pill variant="light" onClick={() => unstable_retry()}>
          Try again
        </Pill>
        <PillLink href="/">Home</PillLink>
      </div>

      {error.digest ? <p className="marking mt-6 text-dust">{error.digest}</p> : null}
    </div>
  );
}
