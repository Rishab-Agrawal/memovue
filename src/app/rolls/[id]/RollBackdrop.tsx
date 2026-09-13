import type { RevealMode } from "@prisma/client";

import { PillLink } from "@/components/roll/Chrome";
import { RollHeader } from "@/components/roll/RollHeader";
import { LiveRefresh } from "@/components/roll/LiveRefresh";
import { PhotoGrid, type GridPhoto } from "@/components/roll/PhotoGrid";
import { RollControls, VisibilityNotice } from "@/components/roll/RollParts";
import { formatDay, formatDuration } from "@/lib/format";
import { isCapturing, isOpen } from "@/lib/roll-access";

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
  revealMode: RevealMode;
  /** Only read by the settings screen that edits the reveal. */
  revealDelayHours: number;
  revealedEarly: boolean;
  everyoneCanSee: boolean;
  /** The host's giveaway switch. Only the settings sheet reads it. */
  giveawayAllowed: boolean;
  keptUntil: Date;
  photoCount: number;
  guestCount: number;
  maxGuests: number;
  /** Only the settings sheet, which edits it, reads it. */
  photosPerGuest: number;
  /** What the host has left of their own film, for the camera control below. */
  shotsLeft: number;
  /** Film nobody has claimed. What the shots pool holds. */
  poolLeft: number;
  /** What the host could draw from it once their own film is gone. Zero closes the camera. */
  refill: number;
  /** ZIP downloads this roll has left. Zero makes Save answer instead of navigating. */
  downloadsLeft: number;
}

export type BackdropPhoto = GridPhoto;

/**
 * The host's view of one roll. Separate from the page so the invite, people and settings
 * sheets can render it behind them.
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
  // The shutter, not the seal. A roll can be legible while it is still shooting.
  const ended = now >= roll.finishesAt;
  const revealsIn = formatDuration(roll.revealAt.getTime() - now.getTime());

  return (
    <div className="flex min-h-dvh flex-col">
      <RollHeader
        title={roll.name}
        moments={roll.photoCount}
        people={roll.guestCount}
        finishesAt={roll.finishesAt.getTime()}
        revealAt={roll.revealAt.getTime()}
        open={open}
        now={now.getTime()}
        back="/rolls"
        settingsHref={`/rolls/${roll.id}/settings`}
        peopleHref={`/rolls/${roll.id}/people`}
      />

      {/* Refreshes while anything can still change; an open, finished album schedules nothing. */}
      {open && ended ? null : <LiveRefresh />}

      <div className="space-y-4 px-5 pt-4 pb-6">
        <RollControls
          ended={ended}
          code={roll.code}
          shotsLeft={roll.shotsLeft}
          // The host shoots by joining like anyone else, so the camera and pool go by code.
          cameraHref={`/e/${roll.code}`}
          cameraOff={
            isCapturing(roll, now)
              ? undefined
              : now < roll.startsAt
                ? `Your roll opens ${formatDay(roll.startsAt)}.`
                : "This roll has finished shooting."
          }
          inviteHref={`/rolls/${roll.id}/invite`}
          poolLeft={roll.poolLeft}
          refill={roll.refill}
          poolHref={`/e/${roll.code}/pool`}
          saveHref={open ? `/api/rolls/${roll.id}/download` : undefined}
          downloadsLeft={roll.downloadsLeft}
        />

        {roll.everyoneCanSee ? null : <VisibilityNotice />}

        {/* `code` too, so the host's own still-uploading frames head the wall. */}
        <PhotoGrid
          rollId={roll.id}
          code={roll.code}
          photos={photos}
          sealed={!open}
          revealsIn={revealsIn}
        />

        {/* Said out loud, so a wall that stops at a page does not read as photos missing. */}
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
