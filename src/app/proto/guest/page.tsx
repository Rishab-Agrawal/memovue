"use client";

import { useState } from "react";

import { PillLink } from "../components/Chrome";
import { Pencil } from "../components/Icons";
import { InvitationCover } from "../components/InvitationCover";
import { FILM, HOST, NOW, SHOTS_PER_PERSON } from "../mock";
import { formatCountdown } from "../rules";

/**
 * What a guest gets after scanning the QR. No account, no install — a name and a camera.
 */
export default function GuestInvitation() {
  const [name, setName] = useState("");

  return (
    <div className="h-full">
      <InvitationCover
        coverIndex={0}
        title={FILM.title}
        hostName={HOST.firstName}
        countdown={formatCountdown(FILM.finishAt.getTime() - NOW.getTime())}
        shots={SHOTS_PER_PERSON}
      >
        <label className="flex h-14 items-center gap-3 rounded-2xl bg-surface/85 px-4 backdrop-blur-sm focus-within:ring-1 focus-within:ring-flame">
          <Pencil className="h-4 w-4 shrink-0 text-dust" />
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter your name"
            aria-label="Your name"
            className="w-full bg-transparent text-[16px] text-chalk placeholder:text-dust focus:outline-none"
          />
        </label>

        <PillLink
          href="/proto/guest/camera"
          variant="light"
          full
          inert={!name.trim()}
        >
          Take your camera →
        </PillLink>
      </InvitationCover>
    </div>
  );
}
