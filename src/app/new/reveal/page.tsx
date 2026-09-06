"use client";

import { RevealPicker } from "@/components/roll/RevealPicker";
import { WizardShell } from "@/components/roll/WizardShell";

import { useDraft } from "../DraftContext";

export default function StepReveal() {
  const { draft, update } = useDraft();

  return (
    <WizardShell
      step={4}
      title="When should we reveal your photos?"
      back="/new/finish"
      next={{ label: "Next →", href: "/new/guests" }}
    >
      <RevealPicker
        finishesAt={draft.finishesAt}
        mode={draft.revealMode}
        delayHours={draft.delayHours}
        onChange={(revealMode, delayHours) => update({ revealMode, delayHours })}
      />
    </WizardShell>
  );
}
