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
  /**
   * Whether this roll offers giving away at all. Separate from `give` being zero, which is
   * the ordinary state of a guest who has already given everything they may.
   */
  offered: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState({ pool, shotsLeft, give, reclaim });
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Positive draws out of the pool, negative hands film to it. The server owns the ceilings. */
  async function move(delta: number) {
    const result = await movePool(code, delta);
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

        {/*
          Offered only where it can do something. The giveaway is the host's to allow and
          needs a roll with film to spare, so on most rolls this button is simply not here —
          a permanently dead control explaining a setting the guest cannot change is worse
          than the space it would take up.
        */}
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

        {/*
          Undoing a gift, in one tap and with no slider: somebody reaching for this wants
          their film back, not a negotiation about how much of it. The number on the button
          is what is actually still there — give twelve away, have somebody take eight, and
          this says four, which is the honest answer and the whole rule.
        */}
        {state.reclaim > 0 ? (
          <Pill variant="quiet" full className="mt-3" onClick={() => void move(state.reclaim)}>
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
        onConfirm={(shots) => move(-shots)}
        onCancel={() => setAsking(false)}
      />
    </div>
  );
}
