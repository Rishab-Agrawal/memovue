"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { SHOTS_SPENT } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { RollHeader } from "@/components/roll/RollHeader";
import { RollControls, VisibilityNotice } from "@/components/roll/RollParts";
import { formatDay, formatDuration } from "@/lib/format";
import { useNow } from "@/lib/useNow";

import { PhotoViewer, type ViewerPhoto } from "@/components/roll/PhotoViewer";
import { QueueStatusLine } from "@/components/roll/QueueStatusLine";

export interface FeedPhoto {
  id: string;
  blurData: string;
  by: string | null;
  mine: boolean;
  takenAt?: string;
  /** The 1080px preview. Absent while the roll is sealed, which is the seal. */
  previewUrl?: string;
  /** The full-resolution original, for the viewer. Absent while sealed, for the same reason. */
  fullUrl?: string;
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
}

/**
 * What a guest sees of the roll.
 *
 * Two requests, deliberately separate. `/feed` is a small status poll every twenty seconds —
 * the countdown, the counts, whether the seal has lifted. `/photos` is the grid, in pages of 48,
 * fetched on scroll and never on a timer.
 *
 * The seal is enforced on the server: while a roll is sealed `/photos` returns blur placeholders
 * and no preview URL, so this component does not have to be careful. It renders what it is
 * given.
 */
export function AlbumView({
  code,
  back,
  cameraHref,
}: {
  code: string;
  /** Where the header's arrow goes. Decided by the page, which knows who is holding this. */
  back: string;
  /** The viewfinder, while the roll is still shooting. Absent once it has closed. */
  cameraHref?: string;
}) {
  const router = useRouter();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [photos, setPhotos] = useState<FeedPhoto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const now = useNow();

  /* Bumped when the seal lifts, which throws the sealed page away: those items carry blur
     data and no preview URL, so they cannot simply be upgraded in place. */
  const [generation, setGeneration] = useState(0);

  const loading = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  /* Which request the grid currently belongs to. A reset bumps it, so a page that was already
     in flight lands on a grid it no longer describes and is dropped instead of appended. */
  const request = useRef(0);
  /* Whether this roll has anything left to say. See where it is set, below. */
  const settled = useRef(false);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/r/${code}/feed`, { cache: "no-store" });
      if (!response.ok) {
        setError("We couldn't load this roll.");
        return;
      }
      const next = (await response.json()) as Feed;
      /* Open, and no longer shooting: the seal has lifted and the counts are final, so there
         is nothing left for the poll below to hear about. This is the state an album spends
         the rest of its life in — the one people leave open on a phone and come back to. */
      settled.current = next.open && !next.capturing;
      setFeed((previous) => {
        // The seal lifting while someone is looking at the wall is the moment the whole
        // product exists for, so the page refreshes itself rather than waiting for a tap.
        if (previous && !previous.open && next.open) {
          setGeneration((n) => n + 1);
          // The server decided this page's back link and camera link from a roll that was
          // sealed a moment ago, so they are re-derived rather than left stale.
          router.refresh();
        }
        return next;
      });
    } catch {
      setError("We couldn't load this roll.");
    }
  }, [code, router]);

  /** The next page of the grid. `after` null starts again from the top. */
  const loadPage = useCallback(
    async (after: string | null) => {
      if (loading.current) return;
      loading.current = true;
      const mine = request.current;
      try {
        const query = after ? `?cursor=${encodeURIComponent(after)}` : "";
        const response = await fetch(`/api/r/${code}/photos${query}`, { cache: "no-store" });
        if (!response.ok) return;

        const page = (await response.json()) as { items: FeedPhoto[]; nextCursor: string | null };
        // Superseded while we were waiting: this is page four of a grid that has since
        // started again from the top, and appending it would show the album from the middle.
        if (mine !== request.current) return;

        setPhotos((previous) => (after ? [...previous, ...page.items] : page.items));
        setCursor(page.nextCursor);
        setExhausted(page.nextCursor === null);
      } catch {
        /* A failed page is not a failed roll — the sentinel will ask again on the next scroll. */
      } finally {
        loading.current = false;
      }
    },
    [code],
  );

  /**
   * The wall, as the server has it now.
   *
   * This screen is opened straight out of the camera, seconds after the shutter — long
   * before the photographs it is meant to show have finished uploading, so the grid it
   * loaded on arrival is missing exactly the frames the guest came to look for. The queue
   * calls this the moment it has handed the last one over.
   *
   * Invalidating first, because a page may be in flight: without it the reload is refused by
   * the loading guard, and the wall stays wrong until somebody reloads the page by hand.
   * Pages already scrolled past are dropped, the same as when the seal lifts.
   */
  const reloadWall = useCallback(() => {
    request.current += 1;
    loading.current = false;
    void loadPage(null);
    // The header's counts came from the same stale render.
    void loadStatus();
  }, [loadPage, loadStatus]);

  useEffect(() => {
    /*
      Polling, not push. The seal lifting is a server-side clock event with no request behind
      it, so something has to ask — and twenty seconds is close enough that a guest watching
      the wall at reveal time sees it open on its own.

      What it no longer does is carry the photographs. This response is a few hundred bytes
      whatever the roll holds; the grid below pages through `/photos` on its own schedule.

      The rule below objects to state being set from an effect. That is exactly what a fetch
      does, and there is no render-time way to read a value that does not exist yet.
    */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStatus();

    /*
      Twenty seconds is the right cadence for a roll that is still moving, and the wrong bill
      for one that is not. An album is a thing people leave open — on a phone in a pocket, on
      a tab behind forty others — and an evening of that used to be three requests a minute
      for as long as it stayed there, whether or not anybody was looking and whether or not
      anything could still change. Both of those are askable before we ask the server.

      The interval itself keeps ticking rather than being torn down and rebuilt: a phone taken
      back out of a pocket is current within twenty seconds, and costs nothing until it is.
    */
    const timer = setInterval(() => {
      if (settled.current || document.visibilityState !== "visible") return;
      void loadStatus();
    }, 20_000);
    return () => clearInterval(timer);
  }, [loadStatus]);

  /*
    The grid is rebuilt when the seal lifts, and at no other time.

    It used to restart whenever the sealed photo count changed — which is every time anybody
    at the event takes a picture. Every page that had been scrolled to was thrown away and the
    reader landed back at the top of the wall, mid-scroll, several times a minute. The count
    in the header still ticks up live off the same poll; the grid catches up the next time
    this screen is opened.
  */
  useEffect(() => {
    // Invalidate anything in flight and take the lock off it, so the restart below is not
    // refused by a request whose result is about to be thrown away.
    request.current += 1;
    loading.current = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhotos([]);
    setCursor(null);
    setExhausted(false);
    void loadPage(null);
  }, [loadPage, generation]);

  useEffect(() => {
    /*
      Paging on scroll rather than on a button. At 48 a page, a 12,000-photo wedding is 250
      taps to reach the end of, which is not a gallery — it is a chore. The observer is the
      platform's own answer and costs less than a scroll listener.
    */
    const target = sentinel.current;
    if (!target || exhausted) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) void loadPage(cursor);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [cursor, exhausted, loadPage]);

  if (error) {
    return <p className="px-5 py-10 text-center text-[15px] text-ash">{error}</p>;
  }
  if (!feed) {
    // Frames waiting to be filled, rather than a word. A bare "Loading…" on a black screen
    // reads as a page that failed, which is the wrong thing to think about your photographs.
    return (
      <div className="grid grid-cols-2 gap-3 px-5 py-6" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="animate-wait aspect-[4/5] rounded-2xl bg-surface" />
        ))}
      </div>
    );
  }

  const revealsIn = formatDuration(new Date(feed.revealAt).getTime() - now);

  return (
    <div className="flex min-h-full flex-col">
      <RollHeader
        title={feed.rollName}
        moments={feed.totalPhotos}
        people={feed.guestCount}
        finishesAt={new Date(feed.finishesAt).getTime()}
        revealAt={new Date(feed.revealAt).getTime()}
        open={feed.open}
        now={now}
        back={back}
      />

      <div className="space-y-4 px-5 pt-4 pb-6">
        <QueueStatusLine code={code} onSettled={reloadWall} />

        {cameraHref && feed.capturing ? (
          <RollControls
            ended={!feed.capturing}
            cameraHref={cameraHref}
            cameraOff={feed.me.shotsLeft <= 0 ? SHOTS_SPENT : undefined}
          />
        ) : null}

        {/*
          The one solid block of accent in the product. A banner whose job is to interrupt
          cannot be drawn in the same two colours as everything around it — but the cream this
          used to be was the reference's own, borrowed wholesale. Our orange interrupts just
          as hard on a black screen and is a colour we already own.

          Only for guests who are not signed in. Telling someone with an account that they
          are "currently on guest mode" and should make one is both wrong and the most
          intrusive element on the screen.
        */}
        {feed.me.linked ? null : (
          <Link
            href="/welcome"
            className="flex items-center gap-4 rounded-2xl bg-flame px-4 py-4 text-void"
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

        {photos.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-dust">
            Nothing shot yet. Be the first.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {photos.map((photo, index) => (
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
                      ? (photo.previewUrl ?? photo.blurData ?? undefined)
                      : (photo.blurData || undefined)
                  }
                  alt=""
                  className={cn("h-full w-full object-cover", feed.open && "animate-develop")}
                  style={feed.open ? undefined : { filter: "blur(14px) saturate(0.6)" }}
                />

                {!feed.open ? (
                  <span className="tabular absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-void/60 px-3 py-1.5 text-[13px] whitespace-nowrap text-chalk">
                    Reveals in {revealsIn}
                  </span>
                ) : null}

                {photo.by ? (
                  <span className="marking absolute bottom-3 left-3 text-chalk/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                    {photo.by}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}

        <div ref={sentinel} aria-hidden="true" className="h-px" />

        <p className="text-center text-[12px] text-dust">
          Photos available until {formatDay(new Date(feed.keptUntil))}
        </p>
      </div>

      {viewing !== null ? (
        <PhotoViewer
          photos={photos.map(
            (photo): ViewerPhoto => ({
              id: photo.id,
              by: photo.by,
              takenAt: photo.takenAt,
              // Preview as the fallback rather than nothing: a smaller picture beats a
              // broken frame if a payload ever arrives without the full one.
              src: photo.fullUrl ?? photo.previewUrl ?? "",
            }),
          )}
          startIndex={viewing}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </div>
  );
}
