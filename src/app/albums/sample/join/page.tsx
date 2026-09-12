"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BackButton, Pill } from "@/components/roll/Chrome";
import { InvitationCover, JOIN_LABEL, NameField } from "@/components/roll/InvitationCover";
import { formatCountdown } from "@/lib/format";
import { SAMPLE_ALBUM, SAMPLE_PHOTOS, SAMPLE_SHOTS } from "@/lib/sample-album";

/**
 * A fixed countdown, not a live one.
 *
 * The sample's own evening ended in February, so a real clock against its real finish reads
 * "Ended" on an invitation that has just been handed to somebody. Thirty hours is what a
 * wedding roll looks like the morning of, and it is the same formatter a real one uses.
 */
const COUNTDOWN_MS = 30 * 60 * 60 * 1000;

/**
 * The invitation, for somebody nobody invited.
 *
 * The sample used to open on the viewfinder, which is the second thing a guest meets. This is
 * the first: the card behind the QR code, the cover, the name field, and the button that
 * hands over a camera. Nothing is stored — there is no roll for a name to join — but typing
 * it is a part of the thing being shown, so the field is real and the button waits for it.
 *
 * The cover is the same frame the camera's thumbnail shows, which is the frame the album
 * opens on. One photograph carries the whole sample.
 */
export default function SampleInvitation() {
  const router = useRouter();
  const [name, setName] = useState("");

  return (
    <div className="relative h-dvh">
      <InvitationCover
        // Never reached: the cover below is a real file, and the preset is what stands in
        // when there is no image. It is here because a roll always has one.
        coverIndex={1}
        coverUrl={SAMPLE_PHOTOS[0].url}
        title={SAMPLE_ALBUM.name}
        hostName={SAMPLE_ALBUM.host}
        countdown={formatCountdown(COUNTDOWN_MS)}
        shots={SAMPLE_SHOTS}
      >
        <NameField>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter your name"
            aria-label="Your name"
            className="w-full bg-transparent text-[16px] text-chalk placeholder:text-dust focus:outline-none"
          />
        </NameField>

        <Pill
          variant="light"
          full
          disabled={!name.trim()}
          onClick={() => router.push(`${SAMPLE_ALBUM.href}/camera`)}
        >
          {JOIN_LABEL}
        </Pill>
      </InvitationCover>

      {/* A real invitation has no way out — the guest came here to join. This one is being
          looked at rather than answered, so it has a door. */}
      <div className="absolute top-[calc(var(--safe-top)+1rem)] left-4 z-10">
        <BackButton href="/welcome" label="Leave the sample" />
      </div>
    </div>
  );
}
