"use client";

import { useRouter } from "next/navigation";

import { InvitationPreview } from "@/components/roll/InvitationPreview";
import { SHOT_TIERS } from "@/lib/roll-config";

import { useDraft } from "../DraftContext";

/**
 * The draft's invitation, at full size. A route rather than an overlay here so the phone's
 * own back gesture closes it, which is how anybody leaves a full-screen picture.
 *
 * The countdown and the shot count are whatever the draft holds right now, which on step one
 * is still the defaults. They are the last two things a host picks and the first two they
 * would have to guess at; showing today's answer beats showing a blank.
 */
export default function DraftInvitationPreview() {
  const { draft, hostName } = useDraft();
  const router = useRouter();

  return (
    <InvitationPreview
      coverIndex={draft.coverPreset}
      coverUrl={draft.coverPreviewUrl}
      title={draft.name}
      hostName={hostName}
      finishesAt={draft.finishesAt}
      shots={SHOT_TIERS[draft.shotIndex]}
      close={() => router.push("/new/name")}
    />
  );
}
