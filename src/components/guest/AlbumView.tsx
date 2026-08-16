"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { RollHeader } from "@/components/roll/RollHeader";
import { RollControls, PhotoGrid, VisibilityNotice } from "@/components/roll/RollParts";
import { formatDay } from "@/lib/format";
import { ROLL, NOW, PHOTOS } from "@/lib/mock-REMOVED";
import { formatDuration, revealAt } from "@/lib/roll-config";

type View = "before" | "after-host-only" | "after-everyone";

export default function GuestAlbum() {
  const view = (useSearchParams().get("v") ?? "before") as View;

  const revealed = view !== "before";
  const everyoneCanSee = view === "after-everyone";

  const reveals = revealAt(ROLL.finishAt, ROLL.revealMode, ROLL.revealDelayHours);
  const revealsIn = reveals ? formatDuration(reveals.getTime() - NOW.getTime()) : "";

  // With visibility off a guest sees only what they shot themselves. That is the whole
  // difference between the two revealed states, and the reason both are worth walking.
  const photos = everyoneCanSee ? PHOTOS : PHOTOS.filter((photo) => photo.by === "You");

  return (
    <div className="flex min-h-full flex-col">
      <RollHeader
        title={ROLL.title}
        coverIndex={0}
        moments={photos.length}
        people={ROLL.people}
        middleValue={
          revealed ? formatDay(ROLL.finishAt) : formatDuration(ROLL.finishAt.getTime() - NOW.getTime())
        }
        middleLabel={revealed ? "Ended" : "Left"}
        back="/proto/guest"
      />

      <div className="space-y-4 px-5 pt-4 pb-6">
        <RollControls
          revealed={revealed}
          cameraHref="/proto/guest/camera"
          inviteHref="/proto/guest/camera/invite"
        />

        {/*
          Kept from the reference, and the one place the prototype leaves the palette. A
          banner that has to interrupt cannot be drawn in the same two colours as everything
          around it; this is the only element on any screen whose job is to be noticed
          rather than to recede.
        */}
        <Link
          href="/proto/welcome"
          className="flex items-center gap-4 rounded-2xl bg-[#f2e4bd] px-4 py-4 text-void"
        >
          <span className="flex-1">
            <span className="block text-[16px] font-semibold">
              Sign up to keep your memories alive.
            </span>
            <span className="mt-1 block text-[14px] leading-snug text-void/70">
              You are currently on guest mode. Create an account to keep your memories safe.
            </span>
          </span>
          <span className="text-[18px]" aria-hidden="true">
            →
          </span>
        </Link>

        {everyoneCanSee ? null : <VisibilityNotice />}

        <PhotoGrid
          photos={photos}
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
