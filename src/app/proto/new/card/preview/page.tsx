"use client";

import { CloseButton, PillLink } from "../../../components/Chrome";
import { InvitationCover } from "../../../components/InvitationCover";
import { HOST, NOW } from "../../../mock";
import { SHOT_TIERS, formatCountdown } from "../../../rules";
import { useDraft } from "../../DraftContext";

/**
 * The card at the size a guest actually meets it. The name field is filled with "Preview
 * User" and does nothing — this is a look, not a rehearsal.
 */
export default function CardPreview() {
  const { draft } = useDraft();

  return (
    <div className="relative h-full">
      <InvitationCover
        coverIndex={draft.coverIndex}
        title={draft.title}
        hostName={HOST.name}
        countdown={formatCountdown(draft.finishAt.getTime() - NOW.getTime())}
        shots={SHOT_TIERS[draft.shotIndex]}
      >
        <div className="flex h-14 items-center rounded-2xl bg-surface/80 px-4 text-[16px] text-dust">
          Preview User
        </div>
        <PillLink href="/proto/new/card/preview" variant="light" full inert>
          Take your camera →
        </PillLink>
      </InvitationCover>

      <div className="absolute top-4 right-4">
        <CloseButton href="/proto/new/card" />
      </div>
    </div>
  );
}
