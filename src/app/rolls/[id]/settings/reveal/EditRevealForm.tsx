"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useConfirm } from "@/components/roll/Confirm";
import { EditScreen } from "@/components/roll/EditScreen";
import { RevealPicker, type RevealMode } from "@/components/roll/RevealPicker";

import { updateRevealAction } from "../../actions";

/**
 * Changing when a sealed roll opens.
 *
 * The same screen the wizard sells the decision on, so a host who wants to move their reveal
 * is looking at the frames going sharp or sealed exactly as they did when they chose it. It
 * replaces the "Reveal now" button that used to sit under these rows: opening a roll early is
 * `DURING` — a roll with no seal at all — and is now one of three things this screen can say,
 * rather than a separate irreversible button with its own dialog beside a row that displayed
 * the setting without letting anyone touch it.
 */
export function EditRevealForm({
  rollId,
  finishesAt,
  revealMode: initialMode,
  delayHours: initialDelay,
}: {
  rollId: string;
  finishesAt: Date;
  revealMode: RevealMode;
  delayHours: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [delayHours, setDelayHours] = useState(Math.max(initialDelay, 1));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();

  const dirty = mode !== initialMode || (mode === "DELAY" && delayHours !== initialDelay);

  const save = () => {
    // The one choice here that cannot be taken back, so it is asked for rather than assumed.
    // Every other mode is a date that can be moved again tomorrow.
    if (mode === "DURING") {
      confirm({
        title: "Open the roll as it is shot?",
        body: "Every guest sees every photograph they are allowed to, straight away. A roll cannot be sealed again once it has been opened.",
        action: "Open it",
        danger: true,
        onConfirm: commit,
      });
      return;
    }
    commit();
  };

  const commit = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateRevealAction(rollId, {
        revealMode: mode,
        revealDelayHours: mode === "DELAY" ? delayHours : 0,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/rolls/${rollId}/settings`);
      router.refresh();
    });
  };

  return (
    <EditScreen
      rollId={rollId}
      title="When should we reveal your photos?"
      dirty={dirty}
      saving={pending}
      error={error}
      onSave={save}
    >
      <div className="mt-8">
        <RevealPicker
          finishesAt={finishesAt}
          mode={mode}
          delayHours={delayHours}
          onChange={(nextMode, nextDelay) => {
            setMode(nextMode);
            setDelayHours(nextDelay);
          }}
        />
      </div>

      {/* Fixed to the viewport when it opens, so it costs nothing to leave in the flow. */}
      {confirmDialog}
    </EditScreen>
  );
}
