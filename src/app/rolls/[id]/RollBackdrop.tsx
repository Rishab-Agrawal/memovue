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
  revealMode: "DURING" | "AFTER" | "DELAY";
  /** Only read by the settings screen that edits the reveal; the backdrop never draws it. */
  revealDelayHours: number;
  revealedEarly: boolean;
  everyoneCanSee: boolean;
  /** The host's giveaway switch. Only the settings sheet, which flips it, reads it. */
  giveawayAllowed: boolean;
  keptUntil: Date;
  photoCount: number;
  guestCount: number;
  /** What the roll was set up to hold, which is what a joined count is worth comparing to. */
  maxGuests: number;
  /** The other half of the roll's size. Only the settings sheet, which edits it, reads it. */
  photosPerGuest: number;
  /** What the host has left of their own film, for the camera control below. */
  shotsLeft: number;
  /** Film nobody has claimed. What the shots pool holds, and what keeps the camera live. */
  poolLeft: number;
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
        Frames land, people join and both clocks run down with nobody touching this screen, so
        it asks again for as long as any of that can happen. Open and finished shooting is the
        state an album spends the rest of its life in, and it schedules nothing at all.
      */}
      {open && ended ? null : <LiveRefresh />}

      <div className="space-y-4 px-5 pt-4 pb-6">
        <RollControls
          ended={ended}
          code={roll.code}
          shotsLeft={roll.shotsLeft}
          // The camera is the guest app, and a host shoots their own roll by joining it like
          // anyone else — so this is the roll's code, not its id. Built from the id, it
          // normalised to a 25-character string matching no roll and dead-ended.
          cameraHref={`/e/${roll.code}`}
          // The shutter is only open between the two dates the host picked. It was live from
          // the moment the roll existed, so a host tapping it the week before their wedding
          // was handed a camera the guest app then refused to give film to.
          cameraOff={
            isCapturing(roll, now)
              ? undefined
              : now < roll.startsAt
                ? `Your roll opens ${formatDay(roll.startsAt)}.`
                : "This roll has finished shooting."
          }
          inviteHref={`/rolls/${roll.id}/invite`}
          poolLeft={roll.poolLeft}
          // By the roll's code, like the camera: the pool screen belongs to whoever is
          // holding a camera on this roll, and the host is one of them.
          poolHref={`/e/${roll.code}/pool`}
          saveHref={open ? `/api/rolls/${roll.id}/download` : undefined}
          downloadsLeft={roll.downloadsLeft}
        />

        {roll.everyoneCanSee ? null : <VisibilityNotice />}

        {/* `code` as well as `id`: a host shoots their own roll by joining it, so the wall
            carries their phone's own queue at its head until the server has caught up. */}
        <PhotoGrid
          rollId={roll.id}
          code={roll.code}
          photos={photos}
          sealed={!open}
          revealsIn={revealsIn}
        />

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
