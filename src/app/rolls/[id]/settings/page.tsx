import { isOpen } from "@/lib/roll-access";

import { BACKDROP_PHOTOS, loadRoll } from "../loadRoll";
import { RollBackdrop } from "../RollBackdrop";
import { SettingsSheet } from "./SettingsSheet";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: PageProps<"/rolls/[id]/settings">) {
  const { id } = await params;
  const { roll, photos } = await loadRoll(id, BACKDROP_PHOTOS);

  return (
    <div className="relative min-h-dvh">
      <RollBackdrop roll={roll} photos={photos} />

      <SettingsSheet
        rollId={roll.id}
        name={roll.name}
        startsAt={roll.startsAt}
        finishesAt={roll.finishesAt}
        revealMode={roll.revealMode}
        // The seal is decided by one function everywhere, including here.
        open={isOpen(roll)}
        // Read here rather than in the sheet, which is a client component and may re-render at
        // any moment — a row that is a link or dead depending on the clock has to be decided once.
        beforeStart={roll.startsAt > new Date()}
        maxGuests={roll.maxGuests}
        photosPerGuest={roll.photosPerGuest}
        guestCount={roll.guestCount}
        everyoneCanSee={roll.everyoneCanSee}
      />
    </div>
  );
}
