"use client";

import { FilmHeader } from "../components/FilmHeader";
import { FilmControls, PhotoGrid, VisibilityNotice } from "../components/FilmParts";
import { formatDay } from "../format";
import { FILM, NOW, PHOTOS } from "../mock";
import { formatDuration, revealAt } from "../rules";

/**
 * The host's film home.
 *
 * Pulled out of the page so the invite, people and settings routes can render it behind
 * their sheet — those are overlays on this screen, not separate destinations, and the
 * reference shows the cover through them.
 */
export function FilmBackdrop({ revealed }: { revealed?: boolean }) {
  const reveals = revealAt(FILM.finishAt, FILM.revealMode, FILM.revealDelayHours);
  const revealsIn = reveals ? formatDuration(reveals.getTime() - NOW.getTime()) : "";
  const left = formatDuration(FILM.finishAt.getTime() - NOW.getTime());

  return (
    <div className="flex min-h-full flex-col">
      <FilmHeader
        title={FILM.title}
        coverIndex={0}
        moments={FILM.moments}
        people={FILM.people}
        middleValue={revealed ? formatDay(FILM.finishAt) : left}
        middleLabel={revealed ? "Ended" : "Left"}
        back="/proto/home"
        settingsHref="/proto/film/settings"
      />

      <div className="space-y-4 px-5 pt-4 pb-6">
        <FilmControls
          revealed={Boolean(revealed)}
          cameraHref="/proto/guest/camera"
          inviteHref="/proto/film/invite"
        />

        {FILM.everyoneCanSee ? null : <VisibilityNotice />}

        <PhotoGrid
          photos={PHOTOS}
          sealed={!revealed}
          revealsIn={revealsIn}
          photoHref="/proto/guest/album/photo"
        />

        <p className="text-center text-[12px] text-dust">
          Photos available until {formatDay(FILM.keptUntil)}
        </p>
      </div>
    </div>
  );
}
