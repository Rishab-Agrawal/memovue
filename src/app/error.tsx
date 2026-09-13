"use client";

import { useEffect } from "react";

import { Notice, Pill, PillLink } from "@/components/roll/Chrome";
import { reportClientError } from "@/lib/report";

/**
 * The crash screen, with a retry and the reassurance that queued photos are safe.
 *
 * `unstable_retry` rather than `reset`, because it re-fetches the segment. The digest is printed
 * so a screenshot matches the server alert. Reported here because React catches render errors
 * before `instrumentation-client`'s global handlers can see them.
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
    <Notice
      title="Something went wrong"
      actions={
        <>
          <div className="mt-4 flex items-center gap-2">
            <Pill variant="light" onClick={() => unstable_retry()}>
              Try again
            </Pill>
            <PillLink href="/">Home</PillLink>
          </div>
          {error.digest ? <p className="marking mt-6 text-dust">{error.digest}</p> : null}
        </>
      }
    >
      Nothing you shot is lost — photos wait on your phone until they can be sent.
    </Notice>
  );
}
