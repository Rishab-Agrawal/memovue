"use client";

import { CloseButton, Pill } from "@/components/roll/Chrome";
import { InvitationCover, JOIN_LABEL } from "@/components/roll/InvitationCover";
import { formatCountdown } from "@/lib/format";
import { useNow } from "@/lib/useNow";

/**
 * The invitation at the size a guest actually meets it: the cover and the title together,
 * which is the pairing the picker cannot show. The name field reads "Preview User" and does
 * nothing — this is a look, not a rehearsal.
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
        <Pill variant="light" full disabled>
          {JOIN_LABEL}
        </Pill>
      </InvitationCover>

      <div className="absolute top-4 right-4">
        <CloseButton onClick={close} />
      </div>
    </div>
  );
}
