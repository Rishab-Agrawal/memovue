"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BackButton, Pill } from "@/components/roll/Chrome";
import { ShotsDialog } from "@/components/roll/ShotsDialog";

import { type PoolMove, movePool } from "./actions";

/** The shots pool. Taking film is offered only by the camera, once it has run dry. */
export function PoolScreen({
  code,
  back,
  pool,
  shotsLeft,
  give,
  reclaim,
  offered,
}: {
  code: string;
  /** The camera or the roll, whichever opened this. */
  back: string;
  pool: number;
  shotsLeft: number;
  /** The most this guest may hand over right now. Zero on a roll whose host said no. */
  give: number;
  /** What they gave earlier and can still get back — capped by what is left in the pool. */
  reclaim: number;
  /** Whether this roll offers giving away at all — distinct from `give` being zero. */
  offered: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState({ pool, shotsLeft, give, reclaim });
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** The server owns every ceiling; this only says which button was pressed, and how many. */
  async function move(kind: PoolMove, shots: number) {
    const result = await movePool(code, kind, shots);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setState({
      pool: result.pool,
      shotsLeft: result.shotsLeft,
      give: result.give,
      reclaim: result.back,
    });
    setAsking(false);
    setError(null);
    // The camera and roll screens count film too, and were rendered before this move.
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
          Shots from this common pool will be offered to you once you run out of your shots.
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

        {/* Absent entirely on rolls that do not offer giving away. */}
        {offered ? (
          <>
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
                  : "No more of your shots can be given away."}
              </p>
            ) : null}
          </>
        ) : null}

        {/* Undoing a gift in one tap, for as much of it as is still in the pool. */}
        {state.reclaim > 0 ? (
          <Pill variant="quiet" full className="mt-3" onClick={() => void move("back", state.reclaim)}>
            Take back {state.reclaim} you gave away
          </Pill>
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
        onConfirm={(shots) => move("give", shots)}
        onCancel={() => setAsking(false)}
      />
    </div>
  );
}
