import { PillLink } from "@/components/roll/Chrome";
import { RollHeader } from "@/components/roll/RollHeader";
import { PhotoGrid, type GridPhoto } from "@/components/roll/PhotoGrid";
import { QueueStatusLine } from "@/components/roll/QueueStatusLine";
import { RefreshAt } from "@/components/roll/RefreshAt";
import { RollControls, VisibilityNotice } from "@/components/roll/RollParts";
import { SHOTS_SPENT } from "@/lib/constants";
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
  revealMode: "DURING" | "AFTER" | "DELAY";
  /** Only read by the settings screen that edits the reveal; the backdrop never draws it. */
  revealDelayHours: number;
  revealedEarly: boolean;
  everyoneCanSee: boolean;
  keptUntil: Date;
  photoCount: number;
  guestCount: number;
  /** What the roll was set up to hold, which is what a joined count is worth comparing to. */
  maxGuests: number;
  /** The other half of the roll's size. Only the settings sheet, which edits it, reads it. */
  photosPerGuest: number;
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
 * their sheet — those are overlays on this screen, not separate destinations, and the roll
 * stays visible under them.
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

      {/*
        This screen is rendered once and never asks again, which is right: nothing on it
        changes without somebody navigating — except the seal lifting, whose moment is a date
        on the roll. Only while it is still sealed, so an open roll schedules nothing at all.
      */}
      {open ? null : <RefreshAt at={roll.revealAt.getTime()} />}

      <div className="space-y-4 px-5 pt-4 pb-6">
        {/*
          A host shoots their own roll like anybody else, and lands back here while the last
          frames are still going out. This is what says so, and what refreshes this screen
          once they have — the wall below was rendered from a database that did not have them
          yet, and no amount of waiting on it would have changed that.
        */}
        <QueueStatusLine code={roll.code} />

        <RollControls
          ended={ended}
          // The camera is the guest app, and a host shoots their own roll by joining it like
          // anyone else — so this is the roll's code, not its id. Built from the id, it
          // normalised to a 25-character string matching no roll and dead-ended.
          cameraHref={`/e/${roll.code}`}
          // The shutter is only open between the two dates the host picked. It was live from
          // the moment the roll existed, so a host tapping it the week before their wedding
          // was handed a camera the guest app then refused to give film to.
          cameraOff={
            !isCapturing(roll, now)
              ? now < roll.startsAt
                ? `Your roll opens ${formatDay(roll.startsAt)}.`
                : "This roll has finished shooting."
              : roll.shotsLeft <= 0
                ? SHOTS_SPENT
                : undefined
          }
          inviteHref={`/rolls/${roll.id}/invite`}
          saveHref={open ? `/api/rolls/${roll.id}/download` : undefined}
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
