"use client";

import { useEffect } from "react";

import { Pill } from "@/components/roll/Chrome";
import { Download } from "@/components/roll/Icons";
import { formatStamp } from "@/lib/format";

import type { FeedPhoto } from "./AlbumView";

/**
 * One photograph, full screen.
 *
 * The reference puts Save on the left and pairs it with a share button and an overflow menu.
 * Both are dropped: sharing is the browser's own job on a page that is already a URL, and
 * there was nothing left for a menu to hold. One action, centred.
 */
export function PhotoViewer({
  code,
  photo,
  onClose,
}: {
  code: string;
  photo: FeedPhoto;
  onClose: () => void;
}) {
  // Back closes the viewer rather than leaving the roll — the layer the guest opened is the
  // layer the gesture should take away.
  useEffect(() => {
    window.history.pushState({ mvPhoto: true }, "");
    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (window.history.state?.mvPhoto) window.history.back();
    };
  }, [onClose]);

  const src = `/api/r/${code}/photos/${photo.id}/full`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-void">
      <header className="flex items-start justify-between gap-4 px-5 pt-[calc(var(--safe-top)+1.25rem)]">
        <div>
          <p className="display-md text-[22px] text-chalk italic">{photo.by ?? "Someone"}</p>
          {photo.takenAt ? (
            <p className="mt-1 text-[14px] text-dust">{formatStamp(new Date(photo.takenAt))}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-[18px] text-chalk"
        >
          ✕
        </button>
      </header>

      <div className="flex flex-1 items-center px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={photo.by ? `Photo by ${photo.by}` : "Photo"} className="w-full" />
      </div>

      <div className="flex justify-center px-5 pt-4 pb-[calc(var(--safe-bottom)+2rem)]">
        <Pill variant="quiet" onClick={() => window.open(`${src}?download=1`, "_blank")}>
          <Download className="h-4 w-4" />
          Save
        </Pill>
      </div>
    </div>
  );
}
