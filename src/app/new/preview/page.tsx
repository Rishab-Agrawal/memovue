"use client";

import { CloseButton, PillLink } from "@/components/roll/Chrome";
import { InvitationCover } from "@/components/roll/InvitationCover";
import { formatCountdown } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { SHOT_TIERS } from "@/lib/roll-config";

import { useDraft } from "../DraftContext";

/**
 * The invitation at the size a guest actually meets it: the cover and the title together,
 * which is the pairing the picker on the step behind cannot show. The name field reads
 * "Preview User" and does nothing — this is a look, not a rehearsal.
 *
 * The countdown and the shot count are whatever the draft holds right now, which on step one
 * is still the defaults. They are the last two things a host picks and the first two they
 * would have to guess at; showing today's answer beats showing a blank.
 */
export default function InvitationPreview() {
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
        <PillLink href="/new/preview" variant="light" full inert>
          Take your camera →
        </PillLink>
      </InvitationCover>

      <div className="absolute top-4 right-4">
        <CloseButton href="/new/name" />
      </div>
    </div>
  );
}
