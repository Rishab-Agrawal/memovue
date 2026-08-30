"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { fromWall, toWall } from "@/lib/format";
import { PARTICIPANT_TIERS, SHOT_TIERS } from "@/lib/roll-config";

/**
 * The roll being created, shared across the six wizard steps.
 *
 * It lives in the wizard's layout rather than in each page because App Router layouts keep
 * their state across navigations between the routes they wrap — so stepping forward and back
 * carries the draft with it. Nothing is written until the last step; a half-finished roll is
 * not a thing that should exist in the database.
 */
export type RevealMode = "DURING" | "AFTER" | "DELAY";

export interface Draft {
  name: string;
  startsAt: Date;
  finishesAt: Date;
  revealMode: RevealMode;
  delayHours: number;
  coverPreset: number;
  /**
   * A cover the host picked, already resized, waiting for a roll to belong to.
   *
   * It is held here rather than uploaded on selection because there is nothing to upload it
   * to yet — the roll is not written until the last step, and a staging area for covers of
   * rolls that were never created is a bucket that fills up with nothing.
   */
  coverBlob: Blob | null;
  coverPreviewUrl: string | null;
  participantIndex: number;
  shotIndex: number;
  everyoneCanSee: boolean;
}

type DraftContextValue = {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  /** Replaces the picked cover, revoking whatever object URL it displaces. */
  setCover: (blob: Blob, previewUrl: string) => void;
  clearCover: () => void;
  /** Shown on the invitation card as "Invited by …". */
  hostName: string;
};

const DraftContext = createContext<DraftContextValue | null>(null);

/**
 * Opens on the coming Saturday at 6pm, closing the next night. A default in the past would
 * open the first calendar with its own selection already greyed out.
 */
function defaultWindow() {
  const now = toWall(new Date());
  const today = fromWall(now.year, now.month, now.day);
  const daysUntilSaturday = (6 - toWall(today).weekday + 7) % 7 || 7;

  const start = toWall(new Date(today.getTime() + daysUntilSaturday * 86_400_000));
  return {
    startsAt: fromWall(start.year, start.month, start.day, 18, 0),
    finishesAt: fromWall(start.year, start.month, start.day + 1, 23, 0),
  };
}

export function DraftProvider({
  children,
  hostName,
}: {
  children: ReactNode;
  hostName: string;
}) {
  const [draft, setDraft] = useState<Draft>(() => {
    const window = defaultWindow();
    return {
      name: "",
      startsAt: window.startsAt,
      finishesAt: window.finishesAt,
      revealMode: "AFTER",
      delayHours: 12,
      coverPreset: 0,
      coverBlob: null,
      coverPreviewUrl: null,
      participantIndex: 1,
      shotIndex: 3,
      everyoneCanSee: false,
    };
  });

  const value = useMemo(
    () => ({
      draft,
      hostName,
      update: (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch })),

      /*
        Revoking happens here, outside the updater, rather than inside it. A state updater is
        supposed to be pure and React may run it twice; releasing a URL is a side effect and
        belongs on the event, not on the render.
      */
      setCover: (blob: Blob, previewUrl: string) => {
        if (draft.coverPreviewUrl) URL.revokeObjectURL(draft.coverPreviewUrl);
        setDraft((current) => ({ ...current, coverBlob: blob, coverPreviewUrl: previewUrl }));
      },
      clearCover: () => {
        if (draft.coverPreviewUrl) URL.revokeObjectURL(draft.coverPreviewUrl);
        setDraft((current) => ({ ...current, coverBlob: null, coverPreviewUrl: null }));
      },
    }),
    [draft, hostName],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftContextValue {
  const value = useContext(DraftContext);
  if (!value) throw new Error("useDraft must be used inside the wizard layout.");
  return value;
}

/** What the server action receives. Indices become the real numbers here, once. */
export function draftToInput(draft: Draft, couponCode: string) {
  return {
    name: draft.name.trim(),
    startsAt: draft.startsAt.toISOString(),
    finishesAt: draft.finishesAt.toISOString(),
    revealMode: draft.revealMode,
    revealDelayHours: draft.revealMode === "DELAY" ? draft.delayHours : 0,
    maxGuests: PARTICIPANT_TIERS[draft.participantIndex],
    photosPerGuest: SHOT_TIERS[draft.shotIndex],
    everyoneCanSee: draft.everyoneCanSee,
    coverPreset: draft.coverPreset,
    couponCode,
  };
}
