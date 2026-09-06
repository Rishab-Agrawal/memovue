"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { ProcessedPhoto } from "@/lib/image";
import { enqueuePhoto } from "@/lib/upload-queue";

import { CameraView } from "./CameraView";
import { QueueStatusLine } from "./QueueStatusLine";

interface GuestAppProps {
  code: string;
  rollName: string;
  shotsLeft: number;
  /** The roll's film allowance per guest, which the counter reads as a fraction. */
  shotsTotal: number;
  /** When the shutter closes, in epoch milliseconds. */
  finishesAt: number;
  /**
   * The roll's own screen — the host's `/rolls/[id]`, or the album for everybody else. Both
   * the arrow and the thumbnail lead here, because they are the same door.
   */
  home: string;
  /** This guest's most recent shot, so the roll thumbnail is filled the moment they arrive. */
  latestBlur: string | null;
}

/**
 * The viewfinder, and nothing else.
 *
 * It used to carry the album inside it as a sheet over the live stream, to avoid tearing the
 * `MediaStream` down on every glance. That cost a screen with no URL, a hand-rolled back
 * stack, and a roll that anonymous guests could not reach at all. The album is a sibling route
 * now; the camera comes back up when they return, which is what every native camera app does
 * anyway.
 */
export function GuestApp({
  code,
  rollName,
  shotsLeft: initialShots,
  shotsTotal,
  finishesAt,
  home,
  latestBlur,
}: GuestAppProps) {
  const router = useRouter();

  const [shotsLeft, setShotsLeft] = useState(initialShots);
  const [latestThumb, setLatestThumb] = useState(latestBlur);
  const [closed, setClosed] = useState(false);

  /*
    The camera has its own clock now, because the page only ever had one on the way in.

    `/e/[code]` checks the shutter on load and never again, so a guest who left the viewfinder
    open went on shooting long after the roll ended — and the reserve route lets those photos
    through on purpose, because it cannot tell a frame captured at the party and drained from
    a taxi from one taken the next morning. The grace window is for bytes that were captured
    in time. This is what makes sure only those exist.

    A timer rather than a countdown tick: the closing instant is known exactly, and a shutter
    that keeps working for another twenty seconds is the same bug in miniature. It fires late
    rather than never on a phone that was asleep, which is the correct direction to be wrong.
  */
  useEffect(() => {
    const close = () => {
      setClosed(true);
      router.replace(home);
    };
    const timer = setTimeout(close, Math.max(0, finishesAt - Date.now()));
    return () => clearTimeout(timer);
  }, [finishesAt, home, router]);

  /**
   * No keep/retake step. The shot is spent the moment the shutter fires, the frame flies
   * into the thumbnail, and the upload happens in the background — surviving a locked phone
   * or a dead signal because it goes through the queue rather than straight to the network.
   */
  async function handleCaptured(photo: ProcessedPhoto) {
    const left = Math.max(0, shotsLeft - 1);
    setShotsLeft(left);
    // What the frame flies into, and what stays there afterwards.
    setLatestThumb(photo.blurData);
    await enqueuePhoto(code, photo);

    /*
      Out of film. Sitting on a dead viewfinder with a greyed-out shutter is the camera
      pretending it still has a job, so it closes and hands them the roll.

      The upload is unaffected — the queue is a module, not a component, so it keeps draining
      across a client-side navigation, and the album it lands on shows the same status line.
    */
    if (left === 0) router.push(home);
  }

  return (
    <div className="fixed inset-0 bg-page">
      <div className="h-full pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
        <CameraView
          shotsLeft={shotsLeft}
          shotsTotal={shotsTotal}
          closed={closed}
          onCaptured={handleCaptured}
          latestThumb={latestThumb}
          onLeave={() => router.push(home)}
        />
      </div>

      <Link
        href={home}
        aria-label="Leave the camera"
        className="absolute top-[calc(var(--safe-top)+0.25rem)] left-4 z-10 flex h-11 w-11 items-center justify-center rounded-2xl bg-void/50 text-[20px] text-chalk backdrop-blur-sm transition-colors hover:text-flame"
      >
        ←
      </Link>

      <span className="marking pointer-events-none absolute inset-x-0 top-[calc(var(--safe-top)+0.5rem)] truncate px-16 text-center text-chalk/60">
        {rollName}
      </span>

      <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--safe-top)+2.25rem)]">
        <QueueStatusLine code={code} />
      </div>
    </div>
  );
}
