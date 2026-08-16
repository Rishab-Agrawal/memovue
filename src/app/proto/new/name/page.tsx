"use client";

import { WizardShell } from "../../components/WizardShell";
import { Pencil } from "../../components/Icons";
import { useDraft } from "../DraftContext";

/**
 * The reference offers a SUGGESTIONS list under the field — "Sanjana's party",
 * "Sanjana's Birthday" and so on. Dropped: they are generated from a name we no longer
 * collect, and a host naming their own wedding does not need prompting.
 */
export default function StepName() {
  const { draft, update } = useDraft();

  return (
    <WizardShell
      step={1}
      title="What is the name of your event?"
      subtitle="Choose the perfect title for your film. This title will be visible to all of your film guests."
      back="/proto/home"
      next={{ label: "Next →", href: "/proto/new/start", inert: !draft.title.trim() }}
    >
      <label className="flex h-16 items-center gap-3 rounded-2xl bg-surface px-4 focus-within:ring-1 focus-within:ring-flame">
        <Pencil className="h-4 w-4 shrink-0 text-dust" />
        <input
          value={draft.title}
          onChange={(event) => update({ title: event.target.value })}
          aria-label="Event name"
          className="w-full bg-transparent text-[17px] font-medium text-chalk placeholder:text-dust focus:outline-none"
        />
      </label>
    </WizardShell>
  );
}
