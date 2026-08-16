import { Sheet } from "@/components/roll/Sheet";
import { listParticipants } from "@/lib/rolls";

import { loadRoll } from "../loadRoll";
import { RollBackdrop } from "../RollBackdrop";

export const dynamic = "force-dynamic";

/**
 * The reference opens an "Add Participants" upsell here — three price tiers for raising the
 * cap. We don't sell that, so the same tap answers the question it was really asking: who
 * has actually turned up, and how much film have they spent.
 */
export default async function PeoplePage({ params }: PageProps<"/rolls/[id]/people">) {
  const { id } = await params;
  const { roll, photos } = await loadRoll(id);
  const people = await listParticipants(id);

  return (
    <div className="relative min-h-dvh">
      <RollBackdrop roll={roll} photos={photos} />

      <Sheet
        title="People"
        subtitle={`${people.length} of ${roll.guestCount === 0 ? 0 : roll.guestCount} joined so far.`}
      >
        {people.length === 0 ? (
          <p className="mt-6 text-[15px] text-dust">
            Nobody has joined yet. Share the QR code and they&rsquo;ll appear here.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-hair border-t border-hair">
            {people.map((person) => (
              <li key={person.id} className="flex items-center justify-between py-4">
                <span className="text-[15px] text-chalk">{person.name}</span>
                <span className="tabular text-[13px] text-dust">
                  {person.shotsUsed} shots used
                </span>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  );
}
