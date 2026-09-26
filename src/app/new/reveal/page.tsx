"use client";

import { useState } from "react";

import { Pill } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";
import { RevealPicker } from "@/components/roll/RevealPicker";
import { Toggle } from "@/components/roll/Toggle";
import { WizardShell } from "@/components/roll/WizardShell";

import { useDraft } from "../DraftContext";

/** Two long labels side by side in a narrow box, so they wrap rather than overflow. */
const wrap = "h-auto min-h-12 px-3 py-2 whitespace-normal leading-tight";

export default function StepReveal() {
  const { draft, update } = useDraft();
  const [warning, setWarning] = useState(false);

  const decide = (uploadsAllowed: boolean) => {
    update({ uploadsAllowed, uploadsWarned: true });
    setWarning(false);
  };

  return (
    <>
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

        <div className="mt-7 border-t border-hair pt-6">
          <Toggle
            on={draft.uploadsAllowed}
            // Talked out of it once per roll, the first time it goes on.
            onChange={(on) =>
              on && !draft.uploadsWarned ? setWarning(true) : update({ uploadsAllowed: on })
            }
            labelOn="Allow uploads"
            labelOff="Allow uploads"
          />
        </div>
      </WizardShell>

      <Dialog
        open={warning}
        title="We strongly recommend keeping this off to have a more memorable experience"
        onClose={() => decide(false)}
        actions={
          <>
            <Pill variant="flame" full className={wrap} onClick={() => decide(false)}>
              Keep it off
            </Pill>
            <Pill variant="quiet" full className={wrap} onClick={() => decide(true)}>
              Turn it on anyways
            </Pill>
          </>
        }
      />
    </>
  );
}
