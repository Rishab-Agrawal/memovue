"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CameraView } from "@/components/guest/CameraView";
import { BackButton } from "@/components/roll/Chrome";
import { SAMPLE_ALBUM, SAMPLE_PHOTOS, SAMPLE_SHOTS } from "@/lib/sample-album";

/**
 * The viewfinder, pointed at no roll.
 *
 * The same camera a guest is handed — the same crop, the same shutter, the same flight into
 * the thumbnail — for somebody who has not signed in and is deciding whether to. Every frame
 * is taken and dropped: there is nothing to upload it to and nobody it would belong to, so
 * the thumbnail keeps showing the sample album's own newest frame and leads there.
 *
 * The one thing that differs from a real camera is the arrow. A guest's leads into their
 * roll; this one leads back out to the screen they came from, because the album behind it is
 * not theirs and arriving in it by pressing back would be a wrong turn.
 */
export default function SampleCamera() {
  const router = useRouter();
  const [spent, setSpent] = useState(0);
  const album = () => router.push(SAMPLE_ALBUM.href);

  return (
    <div className="fixed inset-0 bg-page">
      <div className="h-full pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
        <CameraView
          shotsLeft={SAMPLE_SHOTS - spent}
          shotsTotal={SAMPLE_SHOTS}
          latestThumb={SAMPLE_PHOTOS[0].url}
          onCaptured={() => {
            // Out of film, so the camera hands them the album — the same exit a real one has.
            if (spent + 1 === SAMPLE_SHOTS) album();
            setSpent(spent + 1);
          }}
          onLeave={album}
        />
      </div>

      <div className="absolute top-[calc(var(--safe-top)+0.25rem)] left-4 z-10">
        <BackButton href="/welcome" label="Leave the camera" />
      </div>

      <span className="marking pointer-events-none absolute inset-x-0 top-[calc(var(--safe-top)+0.5rem)] truncate px-16 text-center text-chalk/60">
        {SAMPLE_ALBUM.name}
      </span>
    </div>
  );
}
