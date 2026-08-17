import { RollHeader } from "@/components/roll/RollHeader";
import { RollControls, PhotoGrid, VisibilityNotice } from "@/components/roll/RollParts";
import { formatDay, formatDuration } from "@/lib/format";
import { isOpen } from "@/lib/roll-access";

export interface BackdropRoll {
  id: string;
  name: string;
  coverPreset: number;
  coverUrl: string | null;
  startsAt: Date;
  finishesAt: Date;
  revealAt: Date;
  revealMode: "DURING" | "AFTER" | "DELAY";
  revealedEarly: boolean;
  everyoneCanSee: boolean;
  keptUntil: Date;
  photoCount: number;
  guestCount: number;
}

export interface BackdropPhoto {
  id: string;
  by: string;
  plate: number;
}

/**
 * The host's view of one roll.
 *
 * Pulled out of the page so the invite, people and settings routes can render it behind
 * their sheet — those are overlays on this screen, not separate destinations, and the cover
 * shows through them.
 */
export function RollBackdrop({
  roll,
  photos,
}: {
  roll: BackdropRoll;
  photos: BackdropPhoto[];
}) {
  const now = new Date();
  const open = isOpen(roll, now);
  const revealsIn = formatDuration(roll.revealAt.getTime() - now.getTime());

  return (
    <div className="flex min-h-dvh flex-col">
      <RollHeader
        title={roll.name}
        coverIndex={roll.coverPreset}
        coverUrl={roll.coverUrl}
        moments={roll.photoCount}
        people={roll.guestCount}
        middleValue={open ? formatDay(roll.finishesAt) : formatDuration(roll.finishesAt.getTime() - now.getTime())}
        middleLabel={open ? "Ended" : "Left"}
        back="/rolls"
        settingsHref={`/rolls/${roll.id}/settings`}
        peopleHref={`/rolls/${roll.id}/people`}
      />

      <div className="space-y-4 px-5 pt-4 pb-6">
        <RollControls
          revealed={open}
          cameraHref={`/e/${roll.id}`}
          inviteHref={`/rolls/${roll.id}/invite`}
        />

        {roll.everyoneCanSee ? null : <VisibilityNotice />}

        <PhotoGrid
          photos={photos}
          sealed={!open}
          revealsIn={revealsIn}
          photoHref={`/rolls/${roll.id}`}
        />

        <p className="text-center text-[12px] text-dust">
          Photos available until {formatDay(roll.keptUntil)}
        </p>
      </div>
    </div>
  );
}
