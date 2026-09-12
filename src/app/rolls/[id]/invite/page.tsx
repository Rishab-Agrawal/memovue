import { InviteCard } from "@/components/roll/InviteCard";
import { Sheet } from "@/components/roll/Sheet";

import { BACKDROP_PHOTOS, loadRoll } from "../loadRoll";
import { RollBackdrop } from "../RollBackdrop";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: PageProps<"/rolls/[id]/invite">) {
  const { id } = await params;
  const { roll, photos } = await loadRoll(id, BACKDROP_PHOTOS);

  return (
    <div className="relative min-h-dvh">
      <RollBackdrop roll={roll} photos={photos} />

      <Sheet back={`/rolls/${roll.id}`} title="Invite guests to your roll.">
        <InviteCard code={roll.code} />
      </Sheet>
    </div>
  );
}
