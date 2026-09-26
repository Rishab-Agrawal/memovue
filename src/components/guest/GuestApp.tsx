"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { movePool } from "@/app/e/[code]/pool/actions";
import { BackButton } from "@/components/roll/Chrome";
import { Upload } from "@/components/roll/Icons";
import { ShotsDialog } from "@/components/roll/ShotsDialog";
import { UploadButton } from "@/components/roll/UploadButton";
import type { ProcessedPhoto } from "@/lib/image";
import { SHOTS_POOL } from "@/lib/roll-config";
import { addFilm, enqueuePhoto, useFilmLeft, watchConnectivity } from "@/lib/upload-queue";
import { useSkew } from "@/lib/useNow";

import { CameraView } from "./CameraView";

interface GuestAppProps {
  code: string;
  /** Whether the host lets photos in from the library. */
  uploads: boolean;
  shotsLeft: number;
  /** This guest's own allowance, which the counter reads as a fraction. */
  shotsTotal: number;
  /** Film nobody has claimed, as the server last counted it. */
  pool: number;
  /** The most this guest could draw once they run dry, as the server saw it. Zero raises no box. */
  takeMax: number;
  /** When the shutter closes, in epoch milliseconds. */
  finishesAt: number;
  /** The roll's own screen, where both the arrow and the thumbnail lead. */
  home: string;
  /** This guest's most recent shot, so the roll thumbnail is filled the moment they arrive. */
  latestBlur: string | null;
}

/** The viewfinder, and nothing else. The album is a sibling route. */
export function GuestApp({
  code,
  uploads,
  shotsLeft: initialShots,
  shotsTotal,
  pool: initialPool,
  takeMax: initialTakeMax,
  finishesAt,
  home,
  latestBlur,
}: GuestAppProps) {
  const router = useRouter();

  const shotsLeft = useFilmLeft(code, initialShots);
  /** Film drawn out of the pool in this session, and what is left of it afterwards. */
  const [taken, setTaken] = useState(0);
  const [pool, setPool] = useState(initialPool);
  /** They said no to the pool. The navigation is already in flight; this hides the box. */
  const [declined, setDeclined] = useState(false);
  const [latestThumb, setLatestThumb] = useState(latestBlur);
  const [closed, setClosed] = useState(false);

  // Retries what a previous session left when signal returns; `useFilmLeft` starts it.
  useEffect(() => watchConnectivity(code), [code]);

  // The server re-checks refill ceilings on every move; this only caps the offer by the pool.
  const [offer, setOffer] = useState(initialTakeMax);
  const takeMax = Math.min(pool, offer);

  const skew = useSkew();
  // Closes the shutter at the roll's end even if the page stays open. The upload grace is only for photos captured in time.
  useEffect(() => {
    const close = () => {
      setClosed(true);
      router.replace(home);
    };
    const timer = setTimeout(close, Math.max(0, finishesAt - (Date.now() + skew)));
    return () => clearTimeout(timer);
  }, [finishesAt, skew, home, router]);

  /**
   * The shot is spent the moment the shutter fires or a photo is picked; the upload goes through
   * the durable queue.
   */
  function handleCaptured(photo: ProcessedPhoto) {
    setLatestThumb(photo.blurData);
    void enqueuePhoto(code, photo);
  }

  // Out of film with a pool that still has some: offer it. Derived, so arriving already spent works too.
  const asking = !closed && shotsLeft <= 0 && takeMax > 0 && !declined;

  // Out of film with nothing to offer: leave.
  useEffect(() => {
    if (!closed && shotsLeft <= 0 && takeMax <= 0) router.push(home);
  }, [closed, shotsLeft, takeMax, home, router]);

  async function take(shots: number) {
    const result = await movePool(code, "take", shots);
    if (!result.ok) {
      // The pool emptied while they were shooting.
      decline();
      return;
    }
    addFilm(code, result.moved);
    setTaken((had) => had + result.moved);
    setPool(result.pool);
    // The refills left, not `take`, which is zero right after a refill because the camera is full.
    setOffer(result.refill);
  }

  function decline() {
    setDeclined(true);
    router.push(home);
  }

  return (
    <div className="fixed inset-0 bg-page">
      <div className="h-full pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
        <CameraView
          shotsLeft={shotsLeft}
          // The allowance grows with what they draw, so the bar grows with it.
          shotsTotal={shotsTotal + taken}
          closed={closed}
          onCaptured={handleCaptured}
          latestThumb={latestThumb}
          onLeave={() => router.push(home)}
          poolHref={SHOTS_POOL ? `/e/${code}/pool?from=camera` : undefined}
        />
      </div>

      <ShotsDialog
        open={asking}
        title="Take more shots from pool?"
        note={`Up to ${takeMax} of the ${pool} nobody has claimed.`}
        max={takeMax}
        confirmLabel="Take"
        cancelLabel="No thanks"
        onConfirm={take}
        onCancel={decline}
      />

      <div className="absolute top-[calc(var(--safe-top)+0.25rem)] left-4 z-10">
        <BackButton href={home} label="Leave the camera" />
      </div>

      {uploads ? (
        <div className="absolute top-[calc(var(--safe-top)+0.25rem)] right-4 z-10">
          <UploadButton
            left={shotsLeft}
            onPicked={handleCaptured}
            className="flex h-11 items-center gap-2 rounded-2xl bg-surface px-4 text-[14px] font-medium text-chalk transition-[color,scale] duration-150 hover:text-flame active:scale-[0.97]"
          >
            <Upload className="h-[18px] w-[18px]" />
            Upload
          </UploadButton>
        </div>
      ) : null}
    </div>
  );
}
