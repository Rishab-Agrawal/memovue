"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BackButton } from "@/components/roll/Chrome";
import type { ProcessedPhoto } from "@/lib/image";
import {
  carriedForward,
  drainQueue,
  enqueuePhoto,
  subscribeQueue,
  watchConnectivity,
} from "@/lib/upload-queue";

import { CameraView } from "./CameraView";

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

  const [spent, setSpent] = useState(0);
  const [latestThumb, setLatestThumb] = useState(latestBlur);
  const [closed, setClosed] = useState(false);

  /*
    Film this device has already spent that the server has not been told about.

    `initialShots` is counted from `Photo` rows, and a photograph sitting un-uploaded in
    IndexedDB has no row — so a guest who shot their last frames offline and reopened the
    viewfinder was handed the whole quota a second time. Every extra frame then came back
    from the reserve route as `no_shots_left`, which is terminal, so the queue deleted the
    only copy. The camera gave them shots that did not exist and destroyed what they took
    with them.

    A high-water mark, and `shot` is subtracted because the two counters overlap: a frame
    taken in this session is in the queue *and* in `spent`, and counting it twice would take
    two shots off the dial for one press. It only ever rises, so a reservation landing
    mid-session cannot hand a shot back that was already spent.
  */
  const shot = useRef(0);
  const [carried, setCarried] = useState(0);
  useEffect(
    () =>
      subscribeQueue((queue) => {
        if (queue.code !== code) return;
        setCarried((previous) => carriedForward(previous, queue.unreserved, shot.current));
      }),
    [code],
  );

  const shotsLeft = Math.max(0, initialShots - spent - carried);

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

  /*
    The queue keeps going, silently.

    A line under the roll name used to count the photographs still going out, which is the
    app narrating its own housekeeping to somebody holding a camera. The retries it was
    quietly arming are the part worth keeping: whatever a previous session left behind goes
    now, and a phone that finds signal again mid-party picks up without waiting for the next
    shutter press. What is still owed is said on the roll screen instead, where a missing
    photograph is a thing you can actually notice.
  */
  useEffect(() => {
    void drainQueue(code);
    return watchConnectivity(code);
  }, [code]);

  /**
   * No keep/retake step. The shot is spent the moment the shutter fires, the frame flies
   * into the thumbnail, and the upload happens in the background — surviving a locked phone
   * or a dead signal because it goes through the queue rather than straight to the network.
   */
  function handleCaptured(photo: ProcessedPhoto) {
    shot.current += 1;
    setSpent(shot.current);
    const left = Math.max(0, initialShots - shot.current - carried);
    // What the frame flies into, and what stays there afterwards.
    setLatestThumb(photo.blurData);

    /*
      Out of film. Sitting on a dead viewfinder with a greyed-out shutter is the camera
      pretending it still has a job, so it closes and hands them the roll.

      Before the queue rather than after it: writing a photograph into IndexedDB takes long
      enough on a phone to leave the spent viewfinder on screen for several seconds, which is
      the one moment this screen has nothing left to say. The upload is unaffected — the queue
      is a module, not a component, so it keeps draining across the navigation.
    */
    if (left === 0) router.push(home);
    void enqueuePhoto(code, photo);
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

      {/* The same squircle every other screen backs out of, rather than a typed arrow on a
          translucent square that matched nothing. */}
      <div className="absolute top-[calc(var(--safe-top)+0.25rem)] left-4 z-10">
        <BackButton href={home} label="Leave the camera" />
      </div>

      <span className="marking pointer-events-none absolute inset-x-0 top-[calc(var(--safe-top)+0.5rem)] truncate px-16 text-center text-chalk/60">
        {rollName}
      </span>
    </div>
  );
}
