"use client";

import { CloseButton, Pill } from "@/components/roll/Chrome";
import { InvitationCover } from "@/components/roll/InvitationCover";
import { formatCountdown } from "@/lib/format";
import { useNow } from "@/lib/useNow";

/**
 * The invitation at the size a guest actually meets it: the cover and the title together,
 * which is the pairing the picker cannot show. The name field reads "Preview User" and does
 * nothing — this is a look, not a rehearsal.
 *
 * Shown from both places a host chooses those two things: the wizard's first step, where it
 * is a route of its own, and the settings screen that edits the same pair afterwards, where
 * it is an overlay so it can show a cover that has been picked and not yet saved. Hence
 * `close` rather than a href — the two screens leave it by different means.
 *
 * `fixed` rather than filling its parent, so the overlay covers the screen it opens over
 * instead of the middle of a scrolled column.
 */
export function InvitationPreview({
  coverIndex,
  coverUrl,
  title,
  hostName,
  finishesAt,
  shots,
  close,
}: {
  coverIndex: number;
  coverUrl: string | null;
  title: string;
  hostName: string;
  finishesAt: Date;
  shots: number;
  close: () => void;
}) {
  const now = useNow();

  return (
    <div className="fixed inset-0 z-50 bg-void">
      <InvitationCover
        coverIndex={coverIndex}
        coverUrl={coverUrl}
        title={title || "Your roll"}
        hostName={hostName}
        countdown={formatCountdown(finishesAt.getTime() - now)}
        shots={shots}
      >
        <div className="flex h-14 items-center rounded-2xl bg-surface/80 px-4 text-[16px] text-dust">
          Preview User
        </div>
        {/* A button rather than a dead link: there is nowhere for it to go from here. */}
        <Pill variant="light" full disabled>
          Join roll →
        </Pill>
      </InvitationCover>

      <div className="absolute top-4 right-4">
        <CloseButton onClick={close} />
      </div>
    </div>
  );
}
