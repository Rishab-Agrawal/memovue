"use client";

import { DateStep } from "../DateStep";
import { useDraft } from "../DraftContext";
import { finishDateRange } from "@/lib/roll-config";

/**
 * The reference's copy here reads "The roll opens now, and guests can capture photos until
 * the roll closes at your chosen time." Ours cannot say that any more — the roll now has a
 * start of its own — so the sentence only covers the closing half.
 */
export default function StepFinish() {
  const { draft, update } = useDraft();

  return (
    <DateStep
      step={3}
      title="When does your event finish?"
      subtitle="Guests can capture photos until the roll closes at your chosen time."
      back="/proto/new/start"
      nextHref="/proto/new/reveal"
      value={draft.finishAt}
      onChange={(finishAt) => update({ finishAt })}
      range={finishDateRange(draft.startAt)}
    />
  );
}
