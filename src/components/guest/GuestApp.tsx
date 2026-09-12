"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { movePool } from "@/app/e/[code]/pool/actions";
import { BackButton } from "@/components/roll/Chrome";
import { ShotsDialog } from "@/components/roll/ShotsDialog";
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
  /** This guest's own allowance, which the counter reads as a fraction. */
  shotsTotal: number;
  /** Film nobody has claimed, as the server last counted it. */
  pool: number;
  /** The most that may be drawn out of it in one go — half the roll's allowance per guest. */
  takeStep: number;
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
  pool: initialPool,
  takeStep,
  finishesAt,
  home,
  latestBlur,
}: GuestAppProps) {
  const router = useRouter();

  const [spent, setSpent] = useState(0);
  /** Film drawn out of the pool in this session, and what is left of it afterwards. */
  const [taken, setTaken] = useState(0);
  const [pool, setPool] = useState(initialPool);
  /** They said no to the pool. The navigation is already in flight; this hides the box. */
  const [declined, setDeclined] = useState(false);
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

  const shotsLeft = Math.max(0, initialShots + taken - spent - carried);
  const takeMax = Math.min(pool, takeStep);

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
    // What the frame flies into, and what stays there afterwards.
    setLatestThumb(photo.blurData);
    void enqueuePhoto(code, photo);
  }

  /*
    Out of film, with a pool that still has some.

    Sitting on a dead viewfinder with a greyed-out shutter is the camera pretending it still
    has a job. It used to close and hand them the roll; now it asks first, because the roll
    still holds film that nobody has claimed and the moment somebody wants it is exactly this
    one. Declining is the old exit, unchanged.

    Derived rather than raised as an event, so it covers arriving here already spent — which
    is now possible, since the roll's camera tile no longer goes dead on an empty quota.
  */
  const asking = !closed && shotsLeft <= 0 && takeMax > 0 && !declined;

  // And an empty pool behind an empty quota is the old behaviour exactly: there is nothing
  // to offer, so the screen leaves rather than explaining itself.
  useEffect(() => {
    if (!closed && shotsLeft <= 0 && takeMax <= 0) router.push(home);
  }, [closed, shotsLeft, takeMax, home, router]);

  async function take(shots: number) {
    const result = await movePool(code, shots);
    if (!result.ok) {
      // Nothing to be had after all — the pool emptied while they were shooting.
      decline();
      return;
    }
    setTaken((had) => had + result.moved);
    setPool(result.pool);
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
          // Their allowance grows as they draw on the pool, so the rule under the figure has
          // to grow with it — otherwise the bar reads full from the moment they take any.
          shotsTotal={shotsTotal + taken}
          closed={closed}
          onCaptured={handleCaptured}
          latestThumb={latestThumb}
          onLeave={() => router.push(home)}
          poolHref={`/e/${code}/pool?from=camera`}
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
