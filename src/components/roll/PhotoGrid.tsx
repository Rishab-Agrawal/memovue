"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { cn } from "@/lib/cn";
import { useNotice } from "@/components/roll/Confirm";
import { PhotoViewer, type ViewerPhoto } from "@/components/roll/PhotoViewer";
import { GhostTile, LostShots, useUploadQueue } from "@/components/roll/QueueParts";

import { deletePhotoAction } from "@/app/rolls/[id]/actions";

export interface GridPhoto {
  id: string;
  by: string;
  /** Preview link. Null while the roll is sealed, which is what keeps it sealed. */
  url: string | null;
  /** The original, for the viewer. Null while sealed, for the same reason. */
  fullUrl: string | null;
  /** The ~32px inlined JPEG. The whole tile while sealed, which is what sealed looks like. */
  blurData: string;
}

/**
 * One frame on a wall, wherever the wall is.
 *
 * The host's grid and the guest's album had each written this out, and they had already begun
 * to disagree — one positioned the image absolutely and the other did not, one gave the byline
 * unconditionally and the other guarded it. They show the same photograph to the same people
 * on the same evening, so there is one of them now.
 *
 * `src` is the caller's to work out, because what a sealed tile shows differs: the host's wall
 * always has an inlined blur to fall back on, and a guest's may have nothing at all.
 */
export function PhotoTile({
  src,
  by,
  sealed,
  revealsIn,
  onOpen,
}: {
  src: string | undefined;
  /** Null where the roll is not showing whose photograph this is. */
  by: string | null;
  sealed: boolean;
  revealsIn: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      disabled={sealed}
      onClick={onOpen}
      aria-label={by && !sealed ? `Photo by ${by}` : "Hidden photo"}
      className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-void"
    >
      {/*
        The guest's own photograph, blurred, exactly as the guest album shows it. This grid
        used to draw a generated wash while sealed, so a host watching their roll fill up was
        shown abstract art bearing no relation to anything anyone had shot.

        Not next/image: these are already cached at the edge, and the optimiser would proxy
        every frame through our own server to no benefit. An empty string is turned back into
        nothing, because `src=""` is a browser re-requesting the page as an image.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src || undefined}
        alt=""
        className={cn("absolute inset-0 h-full w-full object-cover", !sealed && "animate-develop")}
        style={sealed ? { filter: "blur(14px) saturate(0.6)" } : undefined}
      />

      {sealed ? (
        <span className="tabular absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-void/60 px-3 py-1.5 text-[13px] whitespace-nowrap text-chalk">
          Reveals in {revealsIn}
        </span>
      ) : null}

      {by ? (
        <span className="marking absolute bottom-3 left-3 text-chalk/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
          {by}
        </span>
      ) : null}
    </button>
  );
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
  code,
  photos,
  sealed,
  revealsIn,
}: {
  /** Absent on the sample album: nobody hosts it, so there is nothing to take out of it. */
  rollId?: string;
  /** The roll's join code, which is what this phone's own queue is filed under. Absent on
      the sample album for the same reason: nobody's camera belongs to it. */
  code?: string;
  photos: GridPhoto[];
  sealed: boolean;
  revealsIn: string;
}) {
  const router = useRouter();
  const [viewing, setViewing] = useState<number | null>(null);
  // A refusal from the server, in our own box. It was a `window.alert`, which is the browser
  // reading our error message out in its own voice over the top of the album.
  const [notify, notice] = useNotice();

  /* A host shoots their own roll like anybody else, and lands back here while the last
     frames are still going out. The wall is the server's, and it was rendered before they
     reached it — so those frames are drawn from this phone until it has been asked again. */
  const settle = useCallback(() => router.refresh(), [router]);
  const { shots, waiting, dropped } = useUploadQueue(code, photos, settle);

  /**
   * Taking a photograph out of the album.
   *
   * The host is the only person who can, and this is the only screen they can do it from —
   * so the wiring lives here rather than in a prop the server component would have to thread
   * through. On success the viewer closes and the page reloads: the list is the server's, and
   * refreshing it is cheaper than keeping a second copy in sync with it.
   */
  const remove = rollId
    ? async (photo: ViewerPhoto) => {
        const result = await deletePhotoAction(rollId, photo.id);
        if (!result.ok) {
          notify(result.error);
          return;
        }
        setViewing(null);
        router.refresh();
      }
    : undefined;

  const openable: ViewerPhoto[] = sealed
    ? []
    : photos.map((photo) => ({
        id: photo.id,
        by: photo.by,
        src: photo.fullUrl ?? photo.url ?? "",
      }));

  return (
    <>
      <LostShots count={dropped} />

      <div className="grid grid-cols-2 gap-3">
        {shots.map((shot) => (
          <GhostTile key={shot.localId} shot={shot} waiting={waiting} />
        ))}

        {photos.map((photo, index) => (
          <PhotoTile
            key={photo.id}
            src={photo.url ?? photo.blurData}
            by={photo.by}
            sealed={sealed}
            revealsIn={revealsIn}
            onOpen={() => setViewing(index)}
          />
        ))}
      </div>

      {viewing !== null && openable.length > 0 ? (
        <PhotoViewer
          photos={openable}
          startIndex={viewing}
          onClose={() => setViewing(null)}
          onDelete={remove}
        />
      ) : null}

      {notice}
    </>
  );
}
