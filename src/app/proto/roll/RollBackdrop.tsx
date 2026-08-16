"use client";

import { RollHeader } from "../components/RollHeader";
import { RollControls, PhotoGrid, VisibilityNotice } from "../components/RollParts";
import { formatDay } from "../format";
import { ROLL, NOW, PHOTOS } from "../mock";
import { formatDuration, revealAt } from "../rules";

/**
 * The host's roll home.
 *
 * Pulled out of the page so the invite, people and settings routes can render it behind
 * their sheet — those are overlays on this screen, not separate destinations, and the
 * reference shows the cover through them.
 */
export function RollBackdrop({ revealed }: { revealed?: boolean }) {
  const reveals = revealAt(ROLL.finishAt, ROLL.revealMode, ROLL.revealDelayHours);
  const revealsIn = reveals ? formatDuration(reveals.getTime() - NOW.getTime()) : "";
  const left = formatDuration(ROLL.finishAt.getTime() - NOW.getTime());

  return (
    <div className="flex min-h-full flex-col">
      <RollHeader
        title={ROLL.title}
        coverIndex={0}
        moments={ROLL.moments}
        people={ROLL.people}
        middleValue={revealed ? formatDay(ROLL.finishAt) : left}
        middleLabel={revealed ? "Ended" : "Left"}
        back="/proto/home"
        settingsHref="/proto/roll/settings"
        peopleHref="/proto/roll/people"
      />

      <div className="space-y-4 px-5 pt-4 pb-6">
        <RollControls
          revealed={Boolean(revealed)}
          cameraHref="/proto/guest/camera"
          inviteHref="/proto/roll/invite"
        />

        {ROLL.everyoneCanSee ? null : <VisibilityNotice />}

        <PhotoGrid
          photos={PHOTOS}
          sealed={!revealed}
          revealsIn={revealsIn}
          photoHref="/proto/guest/album/photo"
        />

        <p className="text-center text-[12px] text-dust">
          Photos available until {formatDay(ROLL.keptUntil)}
        </p>
      </div>
    </div>
  );
}
