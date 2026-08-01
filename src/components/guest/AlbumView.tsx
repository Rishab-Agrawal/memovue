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
    return <p className="px-5 py-16 text-center text-[15px] text-paper-dim">Loading…</p>;
  }

  return (
    <div className="pad-safe-bottom min-h-full">
      {/* ------------------------------------------------------------ header */}
      <header className="px-5 pt-5 pb-4">
        {revealed ? (
          <>
            <h1 className="font-display text-[1.9rem] leading-tight text-paper">
              {feed.eventName}
            </h1>
            <p className="mt-1 text-[15px] text-paper-dim">
              {feed.totalPhotos} photo{feed.totalPhotos === 1 ? "" : "s"} from{" "}
              {feed.people.length} {feed.people.length === 1 ? "person" : "people"}
            </p>
          </>
        ) : (
          <div className="safelight rounded-lg border border-line bg-ink-raised p-5">
            <p className="text-[13px] font-medium tracking-[0.16em] text-ember uppercase">
              Everything unlocks in
            </p>
            <p className="mt-2 font-display text-[2.1rem] leading-none text-paper">
              <Countdown
                target={feed.revealAt}
                initial={formatCountdown(feed.revealAt)}
                onElapsed={onRevealed}
              />
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-paper-dim">
              {feed.totalPhotos} photo{feed.totalPhotos === 1 ? "" : "s"} so far. Nobody can see
              any of them yet — not even the person who took them.
            </p>
          </div>
        )}
      </header>

      {/* ------------------------------------------------------------ tabs */}
      {revealed ? (
        <div className="sticky top-0 z-20 flex gap-2 border-b border-line bg-ink/90 px-5 py-3 backdrop-blur-md">
          {(["all", "people"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTab(value);
                if (value === "all") setFilterGuest(null);
              }}
              className={cn(
                "rounded-full px-4 py-1.5 text-[14px] transition-colors",
                tab === value ? "bg-paper text-ink" : "bg-ink-high text-paper-dim",
              )}
            >
              {value === "all" ? "Everyone" : "By person"}
            </button>
          ))}
          {filterGuest ? (
            <button
              type="button"
              onClick={() => setFilterGuest(null)}
              className="ml-auto rounded-full bg-ember/15 px-4 py-1.5 text-[14px] text-ember"
            >
              {filterGuest.name} ✕
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------------------ body */}
      {feed.people.length === 0 ? (
        <p className="px-5 py-16 text-center text-[15px] leading-relaxed text-paper-dim">
          Nothing here yet. Be the first to take one.
        </p>
      ) : revealed && tab === "all" ? (
        <PhotoGrid photos={photos} onOpen={setViewerIndex} />
      ) : revealed && filterGuest ? (
        <PhotoGrid photos={photos} onOpen={setViewerIndex} />
      ) : (
        <PeopleWall
          people={feed.people}
          revealed={revealed}
          onPick={revealed ? (person) => setFilterGuest(person) : undefined}
        />
      )}

      {revealed && (tab === "all" || filterGuest) && !exhausted ? (
        <div className="px-5 py-8 text-center">
          <button
            type="button"
            onClick={() => void loadPhotos(false)}
            disabled={loadingMore}
            className="rounded-full border border-line px-6 py-2.5 text-[14px] text-paper-dim disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
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

function PhotoGrid({
  photos,
  onOpen,
}: {
  photos: ViewerPhoto[];
  onOpen: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {photos.map((photo, index) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onOpen(index)}
          className="relative aspect-square overflow-hidden bg-ink-high"
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
    <ul className="flex flex-col gap-6 px-5 py-5">
      {people.map((person) => (
        <li key={person.id}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="truncate text-[16px] text-paper">
              {person.name}
              {person.isMe ? <span className="ml-2 text-[13px] text-ember">you</span> : null}
            </h2>
            <span className="shrink-0 text-[13px] text-paper-faint tabular">
              {person.count} photo{person.count === 1 ? "" : "s"}
            </span>
          </div>

          <button
            type="button"
            onClick={onPick ? () => onPick(person) : undefined}
            disabled={!onPick}
            className="no-scrollbar mt-2.5 flex w-full gap-2 overflow-x-auto text-left disabled:cursor-default"
          >
            {person.teasers.map((teaser) => (
              <span
                key={teaser.id}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-ink-high"
              >
                {teaser.blurData ? (
                  // eslint-disable-next-line @next/next/no-img-element -- inline data URL
                  <img
                    src={teaser.blurData}
                    alt=""
                    aria-hidden="true"
                    className={cn(
                      "h-full w-full scale-125 object-cover",
                      // Heavier blur than looks necessary: a 32px source scaled up is
                      // already unreadable, and this makes that obvious to the guest.
                      !revealed && "blur-[10px] saturate-[0.85]",
                    )}
                  />
                ) : null}
              </span>
            ))}
            {person.count > person.teasers.length ? (
              <span className="grid h-20 w-20 shrink-0 place-items-center rounded-md border border-line text-[13px] text-paper-faint">
                +{person.count - person.teasers.length}
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
