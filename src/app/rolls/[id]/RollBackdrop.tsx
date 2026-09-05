import { PillLink } from "@/components/roll/Chrome";
import { RollHeader } from "@/components/roll/RollHeader";
import { PhotoGrid, type GridPhoto } from "@/components/roll/PhotoGrid";
import { RollControls, VisibilityNotice } from "@/components/roll/RollParts";
import { formatDay, formatDuration } from "@/lib/format";
import { isOpen } from "@/lib/roll-access";

export interface BackdropRoll {
  id: string;
  /** The six characters on the QR. The guest-facing routes key on this, not on `id`. */
  code: string;
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
  /** What the roll was set up to hold, which is what a joined count is worth comparing to. */
  maxGuests: number;
  /** What the host has left of their own film, for the camera control below. */
  shotsLeft: number;
  /** ZIP downloads this roll has left. Zero makes Save answer instead of navigating. */
  downloadsLeft: number;
}

/** The grid owns this shape; re-declaring it here is how the two drift apart. */
export type BackdropPhoto = GridPhoto;

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
  moreHref,
}: {
  roll: BackdropRoll;
  photos: BackdropPhoto[];
  /** Where the next page of the wall is, when the roll holds more than this one shows. */
  moreHref?: string;
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
          // The camera is the guest app, and a host shoots their own roll by joining it like
          // anyone else — so this is the roll's code, not its id. Built from the id, it
          // normalised to a 25-character string matching no roll and dead-ended.
          cameraHref={`/e/${roll.code}`}
          outOfFilm={roll.shotsLeft <= 0}
          inviteHref={`/rolls/${roll.id}/invite`}
          // Once open, the same two things a host wants: hand the album round, or take it away.
          sendHref={`/rolls/${roll.id}/invite`}
          saveHref={`/api/rolls/${roll.id}/download`}
          downloadsLeft={roll.downloadsLeft}
        />

        {roll.everyoneCanSee ? null : <VisibilityNotice />}

        <PhotoGrid rollId={roll.id} photos={photos} sealed={!open} revealsIn={revealsIn} />

        {/*
          Said out loud rather than left to be noticed. A wall that stops at a number without
          explaining itself reads as photographs having gone missing, which on this product is
          the worst thing a screen can imply.
        */}
        {moreHref ? (
          <div className="flex justify-center pt-1">
            <PillLink href={moreHref} scroll={false}>
              Show more
            </PillLink>
          </div>
        ) : null}

        <p className="text-center text-[12px] text-dust">
          Photos available until {formatDay(roll.keptUntil)}
        </p>
      </div>
    </div>
  );
}
