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
  /** The original, for the viewer. Null while sealed. */
  fullUrl: string | null;
  /** The ~32px inlined JPEG. The whole tile while sealed. */
  blurData: string;
}

/**
 * One frame on a wall, shared by the host's grid and the guest's album. `src` is the caller's
 * to choose, because what a sealed tile can show differs between them.
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
      // The name decides this, not the seal: a guest's own sealed frame is still "Photo by You".
      aria-label={by ? `Photo by ${by}` : "Hidden photo"}
      className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-void"
    >
      {/* Not next/image: already edge-cached. `src=""` would re-request the page, so it becomes undefined. */}
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

/** The host's wall of frames, with the viewer. */
export function PhotoGrid({
  rollId,
  code,
  photos,
  sealed,
  revealsIn,
}: {
  /** Absent on the sample album: nobody hosts it, so there is nothing to take out of it. */
  rollId?: string;
  /** The join code this phone's queue is filed under. Absent on the sample album. */
  code?: string;
  photos: GridPhoto[];
  sealed: boolean;
  revealsIn: string;
}) {
  const router = useRouter();
  const [viewing, setViewing] = useState<number | null>(null);
  const [notify, notice] = useNotice();

  // The host shoots too; their still-uploading frames are drawn from this phone until the wall has them.
  const settle = useCallback(() => router.refresh(), [router]);
  const { shots, waiting, dropped } = useUploadQueue(code, photos, settle);

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
