"use client";

import { useState } from "react";

import { Plate } from "@/components/roll/Plate";
import { PhotoViewer, type ViewerPhoto } from "@/components/roll/PhotoViewer";

export interface GridPhoto {
  id: string;
  by: string;
  /** Signed preview link. Null while the roll is sealed, which is what keeps it sealed. */
  url: string | null;
  plate: number;
}

/**
 * The host's wall of frames.
 *
 * Client-side because it owns the viewer now. Each tile used to be a `Link` pointing at the
 * roll screen it was already on, so tapping a photograph did nothing at all — the full-screen
 * viewer existed but only the guest album could reach it.
 */
export function PhotoGrid({
  rollId,
  photos,
  sealed,
  revealsIn,
}: {
  /** Not a callback for the URL: a function cannot cross the server/client boundary. */
  rollId: string;
  photos: GridPhoto[];
  sealed: boolean;
  revealsIn: string;
}) {
  const [viewing, setViewing] = useState<number | null>(null);

  const openable: ViewerPhoto[] = sealed
    ? []
    : photos.map((photo) => ({
        id: photo.id,
        by: photo.by,
        src: `/api/rolls/${rollId}/photos/${photo.id}/full`,
      }));

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            disabled={sealed}
            onClick={() => setViewing(index)}
            aria-label={sealed ? "Hidden photo" : `Photo by ${photo.by}`}
            className="relative block aspect-[4/5] overflow-hidden rounded-2xl"
          >
            {/*
              A gradient only while there is genuinely nothing to show. This grid drew one
              unconditionally, so a host who opened their own album after the reveal was shown
              abstract art where their guests' photographs should have been.

              Not next/image: the source is a presigned URL that changes on every render, which
              defeats the optimiser's cache and would proxy every frame through our own server.
            */}
            {photo.url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={photo.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <Plate index={photo.plate} className="absolute inset-0" sealed={sealed} />
            )}

            {sealed ? (
              <span className="tabular absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-void/60 px-3 py-1.5 text-[13px] whitespace-nowrap text-chalk">
                Reveals in {revealsIn}
              </span>
            ) : null}

            <span className="absolute bottom-3 left-3 text-[15px] text-chalk italic drop-shadow">
              {photo.by}
            </span>
          </button>
        ))}
      </div>

      {viewing !== null && openable.length > 0 ? (
        <PhotoViewer
          photos={openable}
          startIndex={viewing}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </>
  );
}
