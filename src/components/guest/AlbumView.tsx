"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Countdown } from "@/components/Countdown";
import { cn } from "@/lib/cn";
import { formatCountdown } from "@/lib/reveal";

import { type OpenOrigin, PhotoViewer, type ViewerPhoto } from "./PhotoViewer";

interface Person {
  id: string;
  name: string;
  count: number;
  isMe: boolean;
  teasers: { id: string; blurData: string }[];
}

interface Feed {
  phase: "scheduled" | "capturing" | "revealed";
  revealAt: string;
  eventName: string;
  totalPhotos: number;
  me: { id: string; name: string; shotsLeft: number; shotsUsed: number; photosPerGuest: number };
  people: Person[];
}

/** How long the seal takes to break. Matches `mv-unseal` in globals.css. */
const UNSEAL_MS = 1100;

export function AlbumView({ code, onRevealed }: { code: string; onRevealed?: () => void }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [tab, setTab] = useState<"all" | "people">("all");
  const [filterGuest, setFilterGuest] = useState<Person | null>(null);

  /**
   * The reveal is the entire product, and it used to be a re-render.
   *
   * The countdown hit zero, the component quietly swapped from "hidden" to a grid, and the
   * one moment everyone at the event had been waiting several hours for arrived with less
   * ceremony than a tab change. `breaking` holds the screen for as long as the seal takes to
   * come apart, so the transition is something you watch happen rather than something you
   * notice has happened.
   */
  const [breaking, setBreaking] = useState(false);

  const revealed = feed?.phase === "revealed";

  const loadFeed = useCallback(async () => {
    const response = await fetch(`/api/e/${code}/feed`);
    if (!response.ok) return null;
    return (await response.json()) as Feed;
  }, [code]);

  useEffect(() => {
    let active = true;
    void loadFeed().then((data) => {
      if (active && data) setFeed(data);
    });
    return () => {
      active = false;
    };
  }, [loadFeed]);

  /*
    The countdown reports every second once it's past zero, and React may invoke a state
    updater more than once for a single call — so the latch is a ref, not the `breaking` flag
    itself. Guarding inside the updater would have scheduled the reveal twice.
  */
  const breakingRef = useRef(false);
  const unsealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (unsealTimer.current && clearTimeout(unsealTimer.current)), []);

  const handleElapsed = useCallback(() => {
    if (breakingRef.current) return;
    breakingRef.current = true;
    setBreaking(true);

    unsealTimer.current = setTimeout(async () => {
      const data = await loadFeed();
      if (data) setFeed(data);
      setBreaking(false);
      onRevealed?.();
    }, UNSEAL_MS);
  }, [loadFeed, onRevealed]);

  const showingGrid = revealed && (tab === "all" || Boolean(filterGuest));

  if (!feed) {
    return (
      <div className="pad-safe-bottom min-h-full" aria-busy="true">
        <div className="px-6 pt-8 pb-8">
          <span className="animate-wait block h-3 w-24 bg-hair-bright" />
          <span className="animate-wait mt-5 block h-9 w-3/4 bg-hair-bright" />
        </div>
        <PhotoGridSkeleton />
        <span className="sr-only">Loading the album</span>
      </div>
    );
  }

  return (
    <div className="pad-safe-bottom min-h-full">
      {/* ------------------------------------------------------------ header */}
      <header className="bloom px-6 pt-8 pb-8">
        {revealed ? (
          <>
            <p className="marking text-chalk">Revealed</p>
            <h1 className="display mt-4 text-[2.2rem] text-chalk">{feed.eventName}</h1>
            <p className="marking mt-3">
              <span className="tabular">{feed.totalPhotos}</span> photos ·{" "}
              <span className="tabular">{feed.people.length}</span>{" "}
              {feed.people.length === 1 ? "person" : "people"}
            </p>
          </>
        ) : (
          <div className={cn(breaking && "animate-unseal")}>
            <p className="marking text-flame">
              {breaking ? "Opening the album" : "Everything unlocks in"}
            </p>
            <p className="display tabular mt-4 text-[2.4rem] leading-none text-chalk">
              <Countdown
                target={feed.revealAt}
                initial={formatCountdown(feed.revealAt)}
                onElapsed={handleElapsed}
              />
            </p>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-ash">
              <span className="tabular text-chalk">{feed.totalPhotos}</span> photos so far, hidden
              until then.
            </p>
          </div>
        )}
      </header>

      {/* ------------------------------------------------------------ tabs */}
      {/*
        These are the album's only navigation, and they were 21px tall — a 12px label with
        four pixels of padding, well under half a fingertip, on the screen everyone opens at
        once the moment the reveal lands. The type is unchanged; the target is now 44.
      */}
      {revealed ? (
        <div className="sticky top-0 z-20 flex items-center gap-6 border-y border-hair bg-page/90 px-6 backdrop-blur-md">
          {(["all", "people"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => {
                setTab(value);
                if (value === "all") setFilterGuest(null);
              }}
              className={cn(
                "marking relative flex h-11 items-center transition-colors",
                tab === value ? "text-chalk" : "hover:text-chalk",
              )}
            >
              {value === "all" ? "Everyone" : "By person"}
              {tab === value ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-flame" aria-hidden="true" />
              ) : null}
            </button>
          ))}
          {filterGuest ? (
            <button
              type="button"
              onClick={() => setFilterGuest(null)}
              className="marking ml-auto flex h-11 max-w-[45%] items-center gap-2 text-flame"
            >
              <span className="truncate">{filterGuest.name}</span>
              <ClearIcon />
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------------------ body */}
      {feed.people.length === 0 ? (
        <p className="border-t border-hair px-6 py-20 text-center text-[15px] leading-relaxed text-ash">
          Nothing here yet. Be the first to take one.
        </p>
      ) : showingGrid ? (
        /*
          Keyed by the query it is showing.

          Paging state — the photos so far, the cursor, whether there are more — only ever
          means anything with respect to one particular filter. Holding it a level up meant
          resetting four pieces of state by hand every time the filter changed, from inside an
          effect, which is both a cascading render and the kind of bookkeeping that quietly
          goes wrong later. Changing the key throws the whole stream away and starts a clean
          one, which is what "show me a different person's photos" actually means.
        */
        <PhotoStream key={filterGuest?.id ?? "everyone"} code={code} guestId={filterGuest?.id} />
      ) : (
        <PeopleWall
          people={feed.people}
          revealed={revealed}
          onPick={revealed ? (person) => setFilterGuest(person) : undefined}
        />
      )}
    </div>
  );
}

/**
 * The photo grid, its paging, and the viewer that opens out of it — one unit, because they
 * all describe the same list.
 */
function PhotoStream({ code, guestId }: { code: string; guestId?: string }) {
  const [photos, setPhotos] = useState<ViewerPhoto[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<{ index: number; origin: OpenOrigin } | null>(null);

  // The cursor is a request detail, not something the UI renders, and it's read by a
  // callback that must keep a stable identity — a scroll and a keypress landing in the same
  // frame would otherwise fire two requests for the same page.
  const cursorRef = useRef<string | null>(null);
  const inFlight = useRef(false);

  const loadMore = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cursorRef.current) params.set("cursor", cursorRef.current);
      if (guestId) params.set("guestId", guestId);

      const response = await fetch(`/api/e/${code}/photos?${params}`);
      if (!response.ok) return;
      const data = (await response.json()) as { items: ViewerPhoto[]; nextCursor: string | null };

      cursorRef.current = data.nextCursor;
      setPhotos((current) => [...current, ...data.items]);
      setExhausted(data.nextCursor === null);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [code, guestId]);

  useEffect(() => {
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first page only; the key remounts on any query change
  }, []);

  /*
    Opening a photo is a navigation, so it gets a history entry — and the entry is pushed
    here, in the handler for the tap that caused it, rather than from the viewer's mount
    effect. Effects run twice in development and must be safe to repeat; `pushState` and
    `back()` are not.
  */
  function openViewer(index: number, origin: OpenOrigin) {
    window.history.pushState({ mvViewer: true }, "");
    setViewer({ index, origin });
  }

  function closeViewer() {
    setViewer(null);
    // Closing with the ✕ or a swipe leaves our entry on the stack. Spend it, so the next
    // back press goes where the user expects instead of re-opening nothing.
    if (window.history.state?.mvViewer) window.history.back();
  }

  if (loading && photos.length === 0) return <PhotoGridSkeleton />;

  return (
    <>
      <PhotoGrid photos={photos} onOpen={openViewer} />
      <LoadMore exhausted={exhausted} loading={loading} onLoad={loadMore} />

      {viewer !== null ? (
        <PhotoViewer
          code={code}
          photos={photos}
          startIndex={viewer.index}
          origin={viewer.origin}
          onClose={closeViewer}
          onReachEnd={() => void loadMore()}
        />
      ) : null}
    </>
  );
}

/**
 * Pages in as it's scrolled to, rather than making the guest tap "Load more" through four
 * hundred photos one screen at a time — the viewer already paged itself this way, so the
 * grid asking to be advanced by hand was the odd one out.
 */
function LoadMore({
  exhausted,
  loading,
  onLoad,
}: {
  exhausted: boolean;
  loading: boolean;
  /** Must keep a stable identity — the observer is rebuilt whenever it changes. */
  onLoad: () => unknown;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || exhausted) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoad();
      },
      // A screen of warning, so the next rows are already there by the time they're reached.
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [exhausted, onLoad]);

  if (exhausted) return null;

  return (
    <div ref={sentinelRef} className="px-6 py-10 text-center">
      {loading ? <p className="marking">Loading more</p> : null}
      {/* Reachable without a pointer, and the fallback if IntersectionObserver never fires. */}
      <button
        type="button"
        onClick={() => void onLoad()}
        disabled={loading}
        className="sr-only focus:not-sr-only"
      >
        Load more photos
      </button>
    </div>
  );
}

/** Edge-to-edge with hairline gaps — the photos are the interface, not cards holding them. */
function PhotoGrid({
  photos,
  onOpen,
}: {
  photos: ViewerPhoto[];
  onOpen: (index: number, origin: OpenOrigin) => void;
}) {
  // The hairlines are the container showing through one-pixel gaps, which means an unfilled
  // cell in the last row shows through as a full grey square — indistinguishable from a
  // photo that failed to load. Fill the remainder with the page colour instead.
  const trailing = (3 - (photos.length % 3)) % 3;

  return (
    <div className="grid grid-cols-3 gap-px bg-hair">
      {photos.map((photo, index) => (
        <button
          key={photo.id}
          type="button"
          onClick={(event) => {
            // The viewer expands out of this square, so it needs to know where it was.
            const rect = event.currentTarget.getBoundingClientRect();
            onOpen(index, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
          }}
          className="relative aspect-square overflow-hidden bg-void"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL */}
          <img
            src={photo.previewUrl}
            alt={`Taken by ${photo.guestName}`}
            loading="lazy"
            draggable={false}
            className="animate-develop h-full w-full object-cover transition-transform duration-200 active:scale-[0.97]"
            style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
          />
        </button>
      ))}

      {Array.from({ length: trailing }, (_, index) => (
        <span key={`fill-${index}`} className="aspect-square bg-page" aria-hidden="true" />
      ))}
    </div>
  );
}

/**
 * The shape of the grid, held before the photos arrive.
 *
 * The album used to say "Loading" in 12px grey and then drop a full screen of images into
 * the space that word had been occupying. Reserving the layout up front means nothing under
 * the user's thumb moves when the photos land.
 */
function PhotoGridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-px bg-hair" aria-hidden="true">
      {Array.from({ length: 12 }, (_, index) => (
        <div
          key={index}
          className="animate-wait aspect-square bg-surface"
          style={{ animationDelay: `${index * 70}ms` }}
        />
      ))}
    </div>
  );
}

/**
 * Before the reveal this is the whole social surface: who's shooting and roughly how much,
 * with images blurred past legibility. People with no photos are omitted by the API so
 * nobody is publicly listed as the one not joining in.
 */
function PeopleWall({
  people,
  revealed,
  onPick,
}: {
  people: Person[];
  revealed: boolean;
  onPick?: (person: Person) => void;
}) {
  return (
    <ul className="border-t border-hair">
      {people.map((person) => (
        <li key={person.id} className="border-b border-hair px-6 py-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="truncate text-[17px] text-chalk">
              {person.name}
              {person.isMe ? <span className="marking ml-3 text-flame">you</span> : null}
            </h2>
            <span className="tabular shrink-0 text-[13px] text-ash">{person.count}</span>
          </div>

          <button
            type="button"
            onClick={onPick ? () => onPick(person) : undefined}
            disabled={!onPick}
            aria-label={onPick ? `See ${person.name}'s photos` : undefined}
            className="no-scrollbar mt-4 flex w-full gap-1.5 overflow-x-auto text-left disabled:cursor-default"
          >
            {person.teasers.map((teaser) => (
              <span key={teaser.id} className="h-20 w-20 shrink-0 overflow-hidden bg-surface">
                {teaser.blurData ? (
                  // eslint-disable-next-line @next/next/no-img-element -- inline data URL
                  <img
                    src={teaser.blurData}
                    alt=""
                    aria-hidden="true"
                    className={cn(
                      "h-full w-full scale-125 object-cover",
                      // Heavier blur than strictly necessary: a 32px source scaled up is
                      // already unreadable, and this makes that obvious to the guest.
                      !revealed && "blur-[10px] saturate-[0.8]",
                    )}
                  />
                ) : null}
              </span>
            ))}
            {person.count > person.teasers.length ? (
              <span className="tabular grid h-20 w-20 shrink-0 place-items-center border border-hair text-[12px] text-ash">
                +{person.count - person.teasers.length}
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

function ClearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
