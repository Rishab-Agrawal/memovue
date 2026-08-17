"use client";

import { CloseButton, PillLink } from "@/components/roll/Chrome";
import { InvitationCover } from "@/components/roll/InvitationCover";
import { formatCountdown } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { SHOT_TIERS } from "@/lib/roll-config";

import { useDraft } from "../../DraftContext";

/**
 * The card at the size a guest actually meets it. The name field reads "Preview User" and
 * does nothing — this is a look, not a rehearsal.
 */
export default function CardPreview() {
  const { draft, hostName } = useDraft();
  const now = useNow();

  return (
    <div className="relative h-dvh">
      <InvitationCover
        coverIndex={draft.coverPreset}
        coverUrl={draft.coverPreviewUrl}
        title={draft.name || "Your roll"}
        hostName={hostName}
        countdown={formatCountdown(draft.finishesAt.getTime() - now)}
        shots={SHOT_TIERS[draft.shotIndex]}
      >
        <div className="flex h-14 items-center rounded-2xl bg-surface/80 px-4 text-[16px] text-dust">
          Preview User
        </div>
        <PillLink href="/new/card/preview" variant="light" full inert>
          Take your camera →
        </PillLink>
      </InvitationCover>

      <div className="absolute top-4 right-4">
        <CloseButton href="/new/card" />
      </div>
    </div>
  );
}
