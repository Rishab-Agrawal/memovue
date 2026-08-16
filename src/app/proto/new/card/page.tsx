"use client";

import { PillLink } from "../../components/Chrome";
import { InvitationCover } from "../../components/InvitationCover";
import { WizardShell } from "../../components/WizardShell";
import { HOST, NOW } from "../../mock";
import { SHOT_TIERS, formatCountdown } from "../../rules";
import { useDraft } from "../DraftContext";

export default function StepCard() {
  const { draft } = useDraft();

  const countdown = formatCountdown(draft.finishAt.getTime() - NOW.getTime());
  const shots = SHOT_TIERS[draft.shotIndex];

  return (
    <WizardShell
      step={5}
      title="Design your roll invitation card."
      subtitle="This cover is the first thing guests see when they are invited to your roll."
      back="/proto/new/reveal"
      next={{ label: "Next →", href: "/proto/new/guests" }}
    >
      <div className="rounded-3xl bg-surface p-5">
        {/* A static miniature of the guest landing, not an iframe — it only has to show what
            the cover looks like with the title on it. */}
        <div className="mx-auto h-[330px] w-[165px] overflow-hidden rounded-[1.75rem] border-4 border-hair-bright">
          <InvitationCover
            mini
            coverIndex={draft.coverIndex}
            title={draft.title}
            hostName={HOST.firstName}
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
          <PillLink href="/proto/roll/settings/info" variant="quiet" full className="px-3 text-[13px]">
            Edit Cover Image
          </PillLink>
          <PillLink href="/proto/new/card/preview" variant="quiet" full className="px-3 text-[13px]">
            Preview
          </PillLink>
        </div>
      </div>
    </WizardShell>
  );
}
