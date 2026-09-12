"use client";

import { useState } from "react";

import { Pill } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";

/**
 * How many shots, on a slider, with a yes and a no.
 *
 * The same box in both directions: the camera asks for film out of the pool when a guest runs
 * dry, and the pool screen asks how much they are handing back. One component, because the
 * only things that differ are the words on it.
 */
export function ShotsDialog({
  open,
  title,
  note,
  max,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  note: string;
  /** The most that may move. */
  max: number;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: (shots: number) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [wanted, setWanted] = useState(1);
  const [busy, setBusy] = useState(false);

  /*
    Clamped as it is drawn rather than reset in an effect. `max` moves while the box is open —
    somebody else at the party takes the last of the pool — and a thumb that jumps under a
    finger is worse than one that stops where it has to.
  */
  const shots = Math.max(1, Math.min(wanted, max));

  async function confirm() {
    if (busy || max <= 0) return;
    setBusy(true);
    try {
      await onConfirm(shots);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      title={title}
      onClose={busy ? undefined : onCancel}
      actions={
        <>
          <Pill variant="quiet" full disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Pill>
          <Pill variant="flame" full disabled={busy || max <= 0} onClick={confirm}>
            {confirmLabel}
          </Pill>
        </>
      }
    >
      <p className="tabular text-center text-[44px] leading-none font-medium text-chalk">
        {max > 0 ? shots : 0}
      </p>
      <input
        type="range"
        className="film-slider mt-1"
        min={1}
        max={Math.max(1, max)}
        step={1}
        value={shots}
        disabled={max <= 0}
        aria-label={title}
        aria-valuetext={`${shots} shots`}
        onChange={(event) => setWanted(Number(event.target.value))}
      />
      <p className="text-center text-[13px] text-dust">{note}</p>
    </Dialog>
  );
}
