"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

import { PhotoTile } from "@/components/roll/PhotoGrid";
import { RollHeader } from "@/components/roll/RollHeader";
import { RollControls, VisibilityNotice } from "@/components/roll/RollParts";
import { formatDay, formatDuration } from "@/lib/format";
import type { Sponsor } from "@/lib/referrals";
import { useNow } from "@/lib/useNow";

import { PhotoViewer, type ViewerPhoto } from "@/components/roll/PhotoViewer";
import { GhostTile, LostShots, useUploadQueue } from "@/components/roll/QueueParts";

export interface FeedPhoto {
  id: string;
  blurData: string;
  by: string | null;
  takenAt?: string;
  /** The 1080px preview. Absent while the roll is sealed, which is the seal. */
  previewUrl?: string;
  /** The full-resolution original, for the viewer. Absent while sealed. */
  fullUrl?: string;
}

export interface Feed {
  open: boolean;
  capturing: boolean;
  rollName: string;
  everyoneCanSee: boolean;
  revealAt: string;
  finishesAt: string;
  keptUntil: string;
  totalPhotos: number;
  guestCount: number;
  /** Film nobody has claimed, which is what the shots pool holds. */
  poolLeft: number;
  me: {
    shotsLeft: number;
    /** What they could draw from the pool once empty. Zero means the camera has nothing. */
    refill: number;
    /** Whether this guest is attached to an account. */
    linked: boolean;
  };
}

/**
 * What a guest sees of the roll.
 *
 * `/feed` is a small status poll every twenty seconds; `/photos` is the grid, paged on scroll
 * and refetched at the head only when the poll's count moves. The seal is enforced by the server.
 */
export function AlbumView({
  code,
  back,
  cameraHref,
  sponsor,
}: {
  code: string;
  /** Where the header's arrow goes; null for a guest with no account. */
  back: string | null;
  /** The viewfinder, while the roll is still shooting. */
  cameraHref?: string;
  /** The wedding business whose referral code created this roll, named in the header. */
  sponsor?: Sponsor | null;
}) {
  const router = useRouter();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [photos, setPhotos] = useState<FeedPhoto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();

  /* Bumped when the seal lifts: sealed items carry no preview URL, so the grid restarts. */
  const [generation, setGeneration] = useState(0);

  const loading = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  /* Which request the grid belongs to. A reset bumps it, so an in-flight page is dropped. */
  const request = useRef(0);
  /* Open and no longer shooting: nothing left to poll for. */
  const settled = useRef(false);
  /* The roll's count at the last poll, and the wall as last drawn — what `loadNew` compares. */
  const lastTotal = useRef<number | null>(null);
  const shown = useRef<FeedPhoto[]>([]);
  useEffect(() => {
    shown.current = photos;
  }, [photos]);

  /**
   * Frames that landed since the last look, merged over the head of the wall so the reader keeps
   * their scroll position. If the new first page shares nothing with the wall, it starts over.
   */
  const loadNew = useCallback(async () => {
    try {
      const response = await fetch(`/api/r/${code}/photos`, { cache: "no-store" });
      if (!response.ok) return;
      const page = (await response.json()) as { items: FeedPhoto[]; nextCursor: string | null };
      const head = new Set(page.items.map((photo) => photo.id));

      if (!shown.current.some((photo) => head.has(photo.id))) {
        request.current += 1;
        loading.current = false;
        setPhotos(page.items);
        setCursor(page.nextCursor);
        setExhausted(page.nextCursor === null);
        return;
      }
      setPhotos((previous) => [...page.items, ...previous.filter((photo) => !head.has(photo.id))]);
    } catch {
      /* The next count that moves asks again. */
    }
  }, [code]);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/r/${code}/feed`, { cache: "no-store" });
      if (!response.ok) {
        setError("We couldn't load this roll.");
        return;
      }
      const next = (await response.json()) as Feed;
      if (lastTotal.current !== null && next.totalPhotos !== lastTotal.current) void loadNew();
      lastTotal.current = next.totalPhotos;
      settled.current = next.open && !next.capturing;
      setFeed((previous) => {
        // The seal lifting while someone watches refreshes the page on its own.
        if (previous && !previous.open && next.open) {
          setGeneration((n) => n + 1);
          // The server-rendered back and camera links were decided while sealed.
          router.refresh();
        }
        return next;
      });
    } catch {
      setError("We couldn't load this roll.");
    }
  }, [code, router, loadNew]);

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
        // Superseded by a restart while waiting.
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
   * The wall as the server has it now. The queue calls this once it has handed over the last
   * frame, since this screen usually opens before the guest's photos finish uploading.
   * Invalidates first, so an in-flight page cannot block the reload.
   */
  const reloadWall = useCallback(() => {
    request.current += 1;
    loading.current = false;
    void loadPage(null);
    // The header's counts came from the same stale render.
    void loadStatus();
  }, [loadPage, loadStatus]);

  /* Frames this phone is still holding, drawn at the head of the wall until the wall has them. */
  const queue = useUploadQueue(code, photos, reloadWall);

  useEffect(() => {
    // Polling, because the seal lifting is a clock event with no request behind it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStatus();

    // Only while something can still change and somebody is looking.
    const poll = () => {
      if (!settled.current && document.visibilityState === "visible") void loadStatus();
    };
    const timer = setInterval(poll, 20_000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [loadStatus]);

  // The grid is rebuilt when the seal lifts and at no other time; new frames are `loadNew`'s.
  useEffect(() => {
    request.current += 1;
    loading.current = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhotos([]);
    setCursor(null);
    setExhausted(false);
    void loadPage(null);
  }, [loadPage, generation]);

  useEffect(() => {
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
    return (
      <div className="grid grid-cols-2 gap-3 px-5 py-6" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="animate-wait aspect-[4/5] rounded-2xl bg-surface" />
        ))}
      </div>
    );
  }

  return (
    <AlbumScreen
      feed={feed}
      photos={photos}
      now={now}
      back={back}
      sponsor={sponsor}
      code={code}
      cameraHref={cameraHref}
      inviteHref={`/e/${code}/invite`}
      peopleHref={`/e/${code}/people`}
      poolHref={`/e/${code}/pool`}
      queue={queue}
      sentinel={sentinel}
    />
  );
}

const NO_QUEUE = { shots: [], waiting: false, dropped: 0 };

/**
 * The guest's roll home as drawn, whoever feeds it: `AlbumView` from the server, and the live
 * sample from a roll that is always a day from closing.
 */
export function AlbumScreen({
  feed,
  photos,
  now,
  back,
  sponsor,
  code,
  cameraHref,
  inviteHref,
  peopleHref,
  poolHref,
  queue = NO_QUEUE,
  sentinel,
}: {
  feed: Feed;
  photos: FeedPhoto[];
  now: number;
  /** Where the header's arrow goes; null for a guest with no account. */
  back: string | null;
  sponsor?: Sponsor | null;
  /** The join code this phone's queue is filed under. Absent on the sample. */
  code?: string;
  /** The viewfinder, while the roll is still shooting. */
  cameraHref?: string;
  inviteHref?: string;
  peopleHref?: string;
  poolHref?: string;
  /** Frames this phone is still holding. Absent on the sample, which uploads nothing. */
  queue?: ReturnType<typeof useUploadQueue>;
  /** Where scrolling asks for the next page. Absent where the wall is all there is. */
  sentinel?: RefObject<HTMLDivElement | null>;
}) {
  const [viewing, setViewing] = useState<number | null>(null);
  const { shots, waiting, dropped } = queue;
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
        back={back ?? undefined}
        peopleHref={peopleHref}
        sponsor={sponsor}
      />

      <div className="space-y-4 px-5 pt-4 pb-6">
        <LostShots count={dropped} />

        {cameraHref && feed.capturing ? (
          <RollControls
            ended={!feed.capturing}
            code={code}
            shotsLeft={feed.me.shotsLeft}
            cameraHref={cameraHref}
            inviteHref={inviteHref}
            poolHref={poolHref}
            poolLeft={feed.poolLeft}
            refill={feed.me.refill}
          />
        ) : null}

        {/* Only for guests who are not signed in. */}
        {feed.me.linked ? null : (
          <Link
            href="/welcome"
            className="flex items-center gap-4 rounded-2xl bg-surface px-4 py-4 transition-[background-color,scale] duration-150 hover:bg-hair-bright active:scale-[0.98]"
          >
            <span className="flex-1">
              <span className="block text-[16px] font-semibold text-chalk">
                Sign up to keep your memories alive.
              </span>
              <span className="mt-1 block text-[14px] leading-snug text-ash">
                You are currently on guest mode. Create an account to keep your memories safe.
              </span>
            </span>
            <span className="text-[18px] text-dust" aria-hidden="true">
              →
            </span>
          </Link>
        )}

        {feed.everyoneCanSee ? null : <VisibilityNotice />}

        {photos.length === 0 && shots.length === 0 ? (
          // When only the host sees everything, an empty wall says nothing about other guests.
          <p className="py-10 text-center text-[15px] text-dust">
            {feed.everyoneCanSee
              ? "Nothing shot yet. Be the first."
              : "Nothing of yours yet. Your photos land here."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {shots.map((shot) => (
              <GhostTile key={shot.localId} shot={shot} waiting={waiting} />
            ))}

            {photos.map((photo, index) => (
              <PhotoTile
                key={photo.id}
                src={feed.open ? (photo.previewUrl ?? photo.blurData) : photo.blurData}
                by={photo.by}
                sealed={!feed.open}
                revealsIn={revealsIn}
                onOpen={() => setViewing(index)}
              />
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
