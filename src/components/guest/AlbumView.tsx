"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { RollHeader } from "@/components/roll/RollHeader";
import { RollControls, VisibilityNotice } from "@/components/roll/RollParts";
import { formatDay, formatDuration } from "@/lib/format";
import { useNow } from "@/lib/useNow";

import { PhotoViewer, type ViewerPhoto } from "@/components/roll/PhotoViewer";

export interface FeedPhoto {
  id: string;
  blurData: string;
  by: string | null;
  mine: boolean;
  takenAt?: string;
}

export interface Feed {
  phase: "scheduled" | "capturing" | "closed" | "revealed";
  open: boolean;
  capturing: boolean;
  rollName: string;
  hostName: string;
  coverPreset: number;
  coverUrl: string | null;
  everyoneCanSee: boolean;
  revealAt: string;
  finishesAt: string;
  keptUntil: string;
  totalPhotos: number;
  guestCount: number;
  me: {
    id: string;
    name: string;
    shotsLeft: number;
    shotsUsed: number;
    photosPerGuest: number;
    /** Whether this guest is attached to an account. */
    linked: boolean;
  };
  photos: FeedPhoto[];
}

/**
 * What a guest sees of the roll.
 *
 * The seal is enforced on the server — before the reveal the feed carries blur placeholders
 * and no image ids that resolve to bytes — so this component does not have to be careful. It
 * renders what it is given.
 */
export function AlbumView({
  code,
  onRevealed,
  onOpenCamera,
}: {
  code: string;
  onRevealed?: () => void;
  onOpenCamera?: () => void;
}) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const now = useNow();

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/r/${code}/feed`, { cache: "no-store" });
      if (!response.ok) {
        setError("We couldn't load this roll.");
        return;
      }
      const next = (await response.json()) as Feed;
      setFeed((previous) => {
        // The seal lifting while someone is looking at the wall is the moment the whole
        // product exists for, so the page refreshes itself rather than waiting for a tap.
        if (previous && !previous.open && next.open) onRevealed?.();
        return next;
      });
    } catch {
      setError("We couldn't load this roll.");
    }
  }, [code, onRevealed]);

  useEffect(() => {
    /*
      Polling, not push. The seal lifting is a server-side clock event with no request behind
      it, so something has to ask — and twenty seconds is close enough that a guest watching
      the wall at reveal time sees it open on its own.

      The rule below objects to state being set from an effect. That is exactly what a fetch
      does, and there is no render-time way to read a value that does not exist yet.
    */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = setInterval(load, 20_000);
    return () => clearInterval(timer);
  }, [load]);

  if (error) {
    return <p className="px-5 py-10 text-center text-[15px] text-ash">{error}</p>;
  }
  if (!feed) {
    return <p className="px-5 py-10 text-center text-[15px] text-dust">Loading…</p>;
  }

  const revealsIn = formatDuration(new Date(feed.revealAt).getTime() - now);

  return (
    <div className="flex min-h-full flex-col">
      <RollHeader
        title={feed.rollName}
        coverIndex={feed.coverPreset}
        coverUrl={feed.coverUrl}
        moments={feed.totalPhotos}
        people={feed.guestCount}
        middleValue={
          feed.open
            ? formatDay(new Date(feed.finishesAt))
            : formatDuration(new Date(feed.finishesAt).getTime() - now)
        }
        middleLabel={feed.open ? "Ended" : "Left"}
        // A guest with an account has somewhere of their own to go back to; one without
        // has only the marketing page they arrived past.
        back={feed.me.linked ? "/rolls" : "/"}
      />

      <div className="space-y-4 px-5 pt-4 pb-6">
        {onOpenCamera && feed.capturing ? (
          <RollControls revealed={feed.open} cameraHref="#" inviteHref="#" onCamera={onOpenCamera} />
        ) : null}

        {/*
          Kept from the reference, and the one place the app leaves its palette. A banner
          whose job is to interrupt cannot be drawn in the same two colours as everything
          around it.

          Only for guests who are not signed in. Telling someone with an account that they
          are "currently on guest mode" and should make one is both wrong and the most
          intrusive element on the screen.
        */}
        {feed.me.linked ? null : (
          <Link
            href="/welcome"
            className="flex items-center gap-4 rounded-2xl bg-[#f2e4bd] px-4 py-4 text-void"
          >
            <span className="flex-1">
              <span className="block text-[16px] font-semibold">
                Sign up to keep your memories alive.
              </span>
              <span className="mt-1 block text-[14px] leading-snug text-void/70">
                You are currently on guest mode. Create an account to keep your memories safe.
              </span>
            </span>
            <span className="text-[18px]" aria-hidden="true">
              →
            </span>
          </Link>
        )}

        {feed.everyoneCanSee ? null : <VisibilityNotice />}

        {feed.photos.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-dust">
            Nothing shot yet. Be the first.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {feed.photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                disabled={!feed.open}
                aria-label={photo.by ? `Photo by ${photo.by}` : "Hidden photo"}
                onClick={() => feed.open && setViewing(index)}
                className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-void"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    feed.open
                      ? `/api/r/${code}/photos/${photo.id}/full`
                      : (photo.blurData || undefined)
                  }
                  alt=""
                  className="h-full w-full object-cover"
                  style={feed.open ? undefined : { filter: "blur(14px) saturate(0.6)" }}
                />

                {!feed.open ? (
                  <span className="tabular absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-void/60 px-3 py-1.5 text-[13px] whitespace-nowrap text-chalk">
                    Reveals in {revealsIn}
                  </span>
                ) : null}

                {photo.by ? (
                  <span className="absolute bottom-3 left-3 text-[15px] text-chalk italic drop-shadow">
                    {photo.by}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}

        <p className="text-center text-[12px] text-dust">
          Photos available until {formatDay(new Date(feed.keptUntil))}
        </p>
      </div>

      {viewing !== null ? (
        <PhotoViewer
          photos={feed.photos.map(
            (photo): ViewerPhoto => ({
              id: photo.id,
              by: photo.by,
              takenAt: photo.takenAt,
              src: `/api/r/${code}/photos/${photo.id}/full`,
            }),
          )}
          startIndex={viewing}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </div>
  );
}
