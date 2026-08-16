import { loadRoll } from "../loadRoll";
import { RollBackdrop } from "../RollBackdrop";
import { SettingsSheet } from "./SettingsSheet";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: PageProps<"/rolls/[id]/settings">) {
  const { id } = await params;
  const { roll, photos } = await loadRoll(id);

  return (
    <div className="relative min-h-dvh">
      <RollBackdrop roll={roll} photos={photos} />

      <SettingsSheet
        rollId={roll.id}
        name={roll.name}
        startsAt={roll.startsAt}
        finishesAt={roll.finishesAt}
        revealMode={roll.revealMode}
        everyoneCanSee={roll.everyoneCanSee}
      />
    </div>
  );
}
