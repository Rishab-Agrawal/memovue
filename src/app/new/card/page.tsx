"use client";

import { PillLink } from "@/components/roll/Chrome";
import { InvitationCover } from "@/components/roll/InvitationCover";
import { WizardShell } from "@/components/roll/WizardShell";
import { formatCountdown } from "@/lib/format";
import { SHOT_TIERS } from "@/lib/roll-config";

import { useDraft } from "../DraftContext";

export default function StepCard() {
  const { draft, hostName } = useDraft();

  const countdown = formatCountdown(draft.finishesAt.getTime() - Date.now());
  const shots = SHOT_TIERS[draft.shotIndex];

  return (
    <WizardShell
      step={5}
      title="Design your roll invitation card."
      subtitle="This cover is the first thing guests see when they are invited to your roll."
      back="/new/reveal"
      next={{ label: "Next →", href: "/new/guests" }}
    >
      <div className="rounded-3xl bg-surface p-5">
        {/* A static miniature of the guest landing, not an iframe — it only has to show
            what the cover looks like with the title on it. */}
        <div className="mx-auto h-[330px] w-[165px] overflow-hidden rounded-[1.75rem] border-4 border-hair-bright">
          <InvitationCover
            mini
            coverIndex={draft.coverPreset}
            title={draft.name || "Your roll"}
            hostName={hostName}
            countdown={countdown}
            shots={shots}
          >
            <div className="flex h-5 items-center rounded-full bg-surface/80 px-2 text-[7px] text-dust">
              Enter your name
            </div>
            <div className="flex h-5 items-center justify-center rounded-full bg-chalk text-[7px] font-medium text-void">
              Take your camera →
            </div>
          </InvitationCover>
        </div>

        <div className="mt-5 flex gap-3 border-t border-hair pt-5">
          <CoverPicker />
          <PillLink href="/new/card/preview" variant="quiet" full className="px-3 text-[13px]">
            Preview
          </PillLink>
        </div>
      </div>
    </WizardShell>
  );
}

/** Cycles the preset. Uploading your own cover is a later task. */
function CoverPicker() {
  const { draft, update } = useDraft();

  return (
    <button
      type="button"
      onClick={() => update({ coverPreset: (draft.coverPreset + 1) % 9 })}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-hair-bright bg-surface px-3 text-[13px] font-medium whitespace-nowrap text-chalk transition-colors hover:text-flame"
    >
      Change Cover
    </button>
  );
}
