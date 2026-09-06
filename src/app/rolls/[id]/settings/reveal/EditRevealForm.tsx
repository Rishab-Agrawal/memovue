"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BackButton, Pill } from "@/components/roll/Chrome";
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

  const dirty = mode !== initialMode || (mode === "DELAY" && delayHours !== initialDelay);

  const save = () => {
    // The one choice here that cannot be taken back, so it is asked for rather than assumed.
    // Every other mode is a date that can be moved again tomorrow.
    if (
      mode === "DURING" &&
      !window.confirm(
        "Every guest sees every photograph they are allowed to, straight away. A roll cannot be sealed again once it has been opened.",
      )
    ) {
      return;
    }

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
    <div className="pad-safe-top flex min-h-dvh flex-col px-5 pb-[calc(var(--safe-bottom)+1.5rem)]">
      <BackButton
        href={`/rolls/${rollId}/settings`}
        onNavigate={(event) => {
          if (dirty && !window.confirm("Discard your changes?")) event.preventDefault();
        }}
      />

      <h1 className="display mt-5 text-center text-[30px] text-chalk">
        When should we reveal your photos?
      </h1>

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

      {error ? <p className="mt-4 text-center text-[14px] text-danger">{error}</p> : null}

      <div className="flex-1" />

      <Pill variant="light" full className="mt-8" disabled={pending || !dirty} onClick={save}>
        {pending ? "Saving…" : "Save"}
      </Pill>
    </div>
  );
}
