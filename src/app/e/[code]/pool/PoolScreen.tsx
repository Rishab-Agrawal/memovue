"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BackButton, Pill } from "@/components/roll/Chrome";
import { ShotsDialog } from "@/components/roll/ShotsDialog";

import { movePool } from "./actions";

/**
 * The shots pool, and the one thing anybody can do to it from here.
 *
 * Taking film out is not offered on this screen. It is offered by the camera, at the only
 * moment it means anything — when the viewfinder has run dry — and keeping it there is what
 * stops the per-go ceiling being a formality.
 */
export function PoolScreen({
  code,
  back,
  pool,
  shotsLeft,
  give,
}: {
  code: string;
  /** The camera or the roll, whichever opened this. */
  back: string;
  pool: number;
  shotsLeft: number;
  /** The most this guest may hand back right now. */
  give: number;
}) {
  const router = useRouter();
  const [state, setState] = useState({ pool, shotsLeft, give });
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function giveAway(shots: number) {
    const result = await movePool(code, -shots);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setState({ pool: result.pool, shotsLeft: result.shotsLeft, give: result.give });
    setAsking(false);
    setError(null);
    // The camera and the roll behind this screen both count film, and both were rendered
    // before any of it moved.
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-page">
      <div className="pad-safe-top px-4">
        <BackButton href={back} />
      </div>

      <div className="px-5 pt-6 pb-10">
        <h1 className="display-md text-[24px] text-chalk">Shots pool</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ash">
          The film nobody has claimed — everyone who never turned up, plus whatever guests hand
          back. Run out at the camera and it offers you some.
        </p>

        <div className="mt-6 rounded-2xl bg-surface px-5 py-7 text-center">
          <p
            className="tabular text-[56px] leading-none font-medium text-chalk"
            data-testid="pool-left"
          >
            {state.pool}
          </p>
          <p className="marking mt-2 text-dust">shots in the pool</p>
        </div>

        <p className="mt-4 text-center text-[14px] text-ash">
          You have {state.shotsLeft} of your own left.
        </p>

        <Pill
          variant="flame"
          full
          className="mt-6"
          disabled={state.give <= 0}
          onClick={() => setAsking(true)}
        >
          Giveaway your shots
        </Pill>

        {state.give <= 0 ? (
          <p className="mt-3 text-center text-[13px] text-dust">
            {state.shotsLeft <= 0
              ? "You have no shots left to give."
              : "Half your film stays yours — you have given away all you can."}
          </p>
        ) : null}

        {error ? <p className="mt-3 text-center text-[13px] text-danger">{error}</p> : null}
      </div>

      <ShotsDialog
        open={asking}
        title="Give shots to the pool?"
        note={`Up to ${state.give}. They go to whoever runs out.`}
        max={state.give}
        confirmLabel="Give"
        cancelLabel="Cancel"
        onConfirm={giveAway}
        onCancel={() => setAsking(false)}
      />
    </div>
  );
}
