import { Sheet } from "@/components/roll/Sheet";
import { listParticipants } from "@/lib/rolls";

import { loadRoll } from "../loadRoll";
import { RollBackdrop } from "../RollBackdrop";
import { PeopleList } from "./PeopleList";

export const dynamic = "force-dynamic";

/**
 * The reference opens an "Add Participants" upsell here — three price tiers for raising the
 * cap. We don't sell that, so the same tap answers the question it was really asking: who has
 * actually turned up, how much film have they spent, and — since a full roll turns people
 * away at the door — room for one more tier when it runs out.
 */
export default async function PeoplePage({ params }: PageProps<"/rolls/[id]/people">) {
  const { id } = await params;
  const { roll, photos } = await loadRoll(id);
  const people = await listParticipants(id);

  return (
    <div className="relative min-h-dvh">
      <RollBackdrop roll={roll} photos={photos} />

      <Sheet
        back={`/rolls/${roll.id}`}
        title="People"
        subtitle={`${people.length} of ${roll.maxGuests} joined so far.`}
      >
        <PeopleList rollId={roll.id} people={people} maxGuests={roll.maxGuests} />
      </Sheet>
    </div>
  );
}
