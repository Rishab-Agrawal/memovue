"use client";

import { Button } from "@/components/ui/Button";

/**
 * The one moment a guest sees their own photo. After they keep it, it's sealed until the
 * reveal along with everyone else's — so this is the only chance to decide.
 */
export function ReviewOverlay({
  imageUrl,
  onRetake,
  onKeep,
  busy,
  shotsLeftAfter,
}: {
  imageUrl: string;
  onRetake: () => void;
  onKeep: () => void;
  busy?: boolean;
  shotsLeftAfter: number;
}) {
  return (
    <div className="animate-fade absolute inset-0 z-30 flex flex-col bg-void">
      {/* eslint-disable-next-line @next/next/no-img-element -- object URL from the camera, not a static asset */}
      <img
        src={imageUrl}
        alt="The photo you just took"
        draggable={false}
        className="animate-develop min-h-0 flex-1 object-contain"
      />

      {/*
        `pad-safe-bottom` is the reason this bar isn't sitting under the home indicator any
        more. The class was being asked for here and in the album but had never been written,
        so on every iPhone with a gesture bar the two most consequential buttons in the
        product — the ones that decide whether a photo exists — were inside the strip iOS
        reserves for its own swipe.
      */}
      <div className="pad-safe-bottom border-t border-hair px-6 pt-6">
        <p className="marking text-center">
          {shotsLeftAfter === 0
            ? "Your last shot — make it count"
            : `Keep it and ${shotsLeftAfter} remain`}
        </p>
        {/* Keeping is the common path and gets the room to say so. Two identical slabs made
            retaking look like the equal-weight alternative it isn't. */}
        <div className="mt-5 grid grid-cols-[1fr_1.7fr] gap-3.5">
          <Button variant="secondary" size="lg" full onClick={onRetake} disabled={busy}>
            Retake
          </Button>
          <Button size="lg" full onClick={onKeep} disabled={busy}>
            {busy ? "Saving…" : "Keep it"}
          </Button>
        </div>
      </div>
    </div>
  );
}
