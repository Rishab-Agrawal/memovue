"use client";

import { useCallback, useEffect, useState } from "react";

import { Countdown } from "@/components/Countdown";
import { cn } from "@/lib/cn";
import { formatCountdown } from "@/lib/reveal";

import { PhotoViewer, type ViewerPhoto } from "./PhotoViewer";

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

export function AlbumView({ code, onRevealed }: { code: string; onRevealed?: () => void }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [tab, setTab] = useState<"all" | "people">("all");
  const [filterGuest, setFilterGuest] = useState<Person | null>(null);

  const [photos, setPhotos] = useState<ViewerPhoto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const revealed = feed?.phase === "revealed";

  useEffect(() => {
    let active = true;
    fetch(`/api/e/${code}/feed`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Feed | null) => {
        if (active && data) setFeed(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [code]);

  const loadPhotos = useCallback(
    async (reset: boolean) => {
      if (loadingMore) return;
      setLoadingMore(true);
      try {
        const params = new URLSearchParams();
        if (!reset && cursor) params.set("cursor", cursor);
        if (filterGuest) params.set("guestId", filterGuest.id);

        const response = await fetch(`/api/e/${code}/photos?${params}`);
        if (!response.ok) return;
        const data = (await response.json()) as { items: ViewerPhoto[]; nextCursor: string | null };

        setPhotos((current) => (reset ? data.items : [...current, ...data.items]));
        setCursor(data.nextCursor);
        setExhausted(data.nextCursor === null);
      } finally {
        setLoadingMore(false);
      }
    },
    [code, cursor, filterGuest, loadingMore],
  );

  // Reload the grid whenever the reveal lands or the person filter changes.
  useEffect(() => {
    if (!revealed) return;
    setPhotos([]);
    setCursor(null);
    setExhausted(false);
    void loadPhotos(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadPhotos changes on every cursor update
  }, [revealed, filterGuest]);

  if (!feed) {
    return <p className="marking px-6 py-20 text-center">Loading</p>;
  }

  return (
    <div className="pad-safe-bottom min-h-full">
      {/* ------------------------------------------------------------ header */}
      <header className="bloom px-6 pt-8 pb-8">
        {revealed ? (
          <>
            <p className="marking text-chalk">Revealed</p>
            <h1 className="display mt-4 text-[2.2rem] leading-tight text-chalk">
              {feed.eventName}
            </h1>
            <p className="marking mt-3">
              <span className="tabular">{feed.totalPhotos}</span> photos ·{" "}
              <span className="tabular">{feed.people.length}</span>{" "}
              {feed.people.length === 1 ? "person" : "people"}
            </p>
          </>
        ) : (
          <>
            <p className="marking text-flame">Everything unlocks in</p>
            <p className="display tabular mt-4 text-[2.4rem] leading-none text-chalk">
              <Countdown
                target={feed.revealAt}
                initial={formatCountdown(feed.revealAt)}
                onElapsed={onRevealed}
              />
            </p>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-ash">
              <span className="tabular text-chalk">{feed.totalPhotos}</span> photos so far, hidden
              until then.
            </p>
          </>
        )}
      </header>

      {/* ------------------------------------------------------------ tabs */}
      {revealed ? (
        <div className="sticky top-0 z-20 flex items-center gap-7 border-y border-hair bg-void/95 px-6 py-3.5 backdrop-blur-md">
          {(["all", "people"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTab(value);
                if (value === "all") setFilterGuest(null);
              }}
              className={cn(
                "marking relative py-1 transition-colors",
                tab === value ? "text-chalk" : "hover:text-chalk",
              )}
            >
              {value === "all" ? "Everyone" : "By person"}
              {tab === value ? (
                <span className="absolute inset-x-0 -bottom-3.5 h-px bg-flame" aria-hidden="true" />
              ) : null}
            </button>
          ))}
          {filterGuest ? (
            <button
              type="button"
              onClick={() => setFilterGuest(null)}
              className="marking ml-auto text-flame"
            >
              {filterGuest.name} ✕
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------------------ body */}
      {feed.people.length === 0 ? (
        <p className="border-t border-hair px-6 py-20 text-center text-[15px] leading-relaxed text-ash">
          Nothing here yet. Be the first to take one.
        </p>
      ) : revealed && (tab === "all" || filterGuest) ? (
        <PhotoGrid photos={photos} onOpen={setViewerIndex} />
      ) : (
        <PeopleWall
          people={feed.people}
          revealed={revealed}
          onPick={revealed ? (person) => setFilterGuest(person) : undefined}
        />
      )}

      {revealed && (tab === "all" || filterGuest) && !exhausted ? (
        <div className="px-6 py-10 text-center">
          <button
            type="button"
            onClick={() => void loadPhotos(false)}
            disabled={loadingMore}
            className="marking border border-hair-bright px-6 py-3 transition-colors hover:border-flame hover:text-flame disabled:opacity-50"
          >
            {loadingMore ? "Loading" : "Load more"}
          </button>
        </div>
      ) : null}

      {viewerIndex !== null ? (
        <PhotoViewer
          code={code}
          photos={photos}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onReachEnd={() => {
            if (!exhausted && !loadingMore) void loadPhotos(false);
          }}
        />
      ) : null}
    </div>
  );
}

/** Edge-to-edge with hairline gaps — the photos are the interface, not cards holding them. */
function PhotoGrid({ photos, onOpen }: { photos: ViewerPhoto[]; onOpen: (index: number) => void }) {
  return (
    <div className="grid grid-cols-3 gap-px bg-hair">
      {photos.map((photo, index) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onOpen(index)}
          className="relative aspect-square overflow-hidden bg-void"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL */}
          <img
            src={photo.previewUrl}
            alt={`Taken by ${photo.guestName}`}
            loading="lazy"
            className="animate-develop h-full w-full object-cover"
            style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
          />
        </button>
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
            <span className="tabular shrink-0 text-[13px] text-dust">{person.count}</span>
          </div>

          <button
            type="button"
            onClick={onPick ? () => onPick(person) : undefined}
            disabled={!onPick}
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
              <span className="tabular grid h-20 w-20 shrink-0 place-items-center border border-hair text-[12px] text-dust">
                +{person.count - person.teasers.length}
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
