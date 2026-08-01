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
    <div className="absolute inset-0 z-30 flex flex-col bg-ink">
      {/* eslint-disable-next-line @next/next/no-img-element -- object URL from the camera, not a static asset */}
      <img src={imageUrl} alt="The photo you just took" className="min-h-0 flex-1 object-contain" />

      <div className="pad-safe-bottom px-6 pt-5">
        <p className="mb-4 text-center text-[14px] text-paper-dim">
          {shotsLeftAfter === 0
            ? "This is your last shot — make it count."
            : `Keep it and you'll have ${shotsLeftAfter} left.`}
        </p>
        <div className="flex gap-3">
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
