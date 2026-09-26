"use client";

import type { RevealMode } from "@prisma/client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { fromWall, toWall } from "@/lib/format";
import { PARTICIPANT_TIERS, SHOT_TIERS } from "@/lib/roll-config";

/**
 * The roll being created, shared across the wizard steps. It lives in the wizard's layout, which
 * keeps state across navigation; nothing is written until the last step.
 */
export interface Draft {
  name: string;
  startsAt: Date;
  finishesAt: Date;
  revealMode: RevealMode;
  delayHours: number;
  coverPreset: number;
  /** A resized cover waiting for a roll to belong to; uploaded once the roll exists. */
  coverBlob: Blob | null;
  coverPreviewUrl: string | null;
  /**
   * Whether a photograph was chosen. Outlives the blob, which dies with the page, so a draft
   * restored after a reload or sign-in can say the cover was lost.
   */
  coverPicked: boolean;
  /** The referral code, as typed at Create. Kept here so it survives the trip to Google. */
  referralCode: string;
  participantIndex: number;
  shotIndex: number;
  everyoneCanSee: boolean;
  giveawayAllowed: boolean;
  uploadsAllowed: boolean;
  /** Whether the host has been warned off uploads once in this draft. Asked only the first time. */
  uploadsWarned: boolean;
}

type DraftContextValue = {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  /** Replaces the picked cover, revoking whatever object URL it displaces. */
  setCover: (blob: Blob, previewUrl: string) => void;
  clearCover: () => void;
  /** Shown on the invitation card as "Invited by …". */
  hostName: string;
  /** Prefills the code request form. Empty without an account. */
  hostEmail: string;
  /** False for someone walking the wizard before making an account. See the last step. */
  signedIn: boolean;
  /** Whether the saved draft has been read back yet. See the last step's auto-create. */
  restored: boolean;
};

const DraftContext = createContext<DraftContextValue | null>(null);

/** Opens on the coming Saturday at 6pm, closing the next night. */
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

const STORE = "memovue.draft";

/** The draft across a reload or the trip to Google. The cover blob is not serialisable. */
export function readDraft(): Draft | null {
  try {
    const saved = sessionStorage.getItem(STORE);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as Draft;
    return {
      ...parsed,
      startsAt: new Date(parsed.startsAt),
      finishesAt: new Date(parsed.finishesAt),
      // Absent from a draft written before referral codes existed.
      referralCode: parsed.referralCode ?? "",
      // Absent from a draft written before uploads existed.
      uploadsAllowed: parsed.uploadsAllowed ?? false,
      uploadsWarned: parsed.uploadsWarned ?? false,
      coverBlob: null,
      coverPreviewUrl: null,
    };
  } catch {
    return null;
  }
}

export function writeDraft(draft: Draft) {
  try {
    sessionStorage.setItem(
      STORE,
      JSON.stringify({ ...draft, coverBlob: null, coverPreviewUrl: null }),
    );
  } catch {
    /* A refusal to store costs a reload, not the roll. */
  }
}

/** Called once a roll exists, so the next one does not start half-filled with the last. */
export function forgetDraft() {
  sessionStorage.removeItem(STORE);
}

export function DraftProvider({
  children,
  hostName,
  hostEmail,
  signedIn,
}: {
  children: ReactNode;
  hostName: string;
  hostEmail: string;
  signedIn: boolean;
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
      coverPicked: false,
      referralCode: "",
      participantIndex: 1,
      shotIndex: 3,
      everyoneCanSee: true,
      giveawayAllowed: false,
      uploadsAllowed: false,
      uploadsWarned: false,
    };
  });

  // Restored in an effect, not the initialiser, to avoid a hydration mismatch.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const saved = readDraft();
    /* eslint-disable react-hooks/set-state-in-effect */
    if (saved) setDraft(saved);
    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => writeDraft(draft), [draft]);

  const value = useMemo(
    () => ({
      draft,
      hostName,
      hostEmail,
      signedIn,
      restored,
      update: (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch })),

      // Revoked outside the updater, which must stay pure.
      setCover: (blob: Blob, previewUrl: string) => {
        if (draft.coverPreviewUrl) URL.revokeObjectURL(draft.coverPreviewUrl);
        setDraft((current) => ({
          ...current,
          coverBlob: blob,
          coverPreviewUrl: previewUrl,
          coverPicked: true,
        }));
      },
      clearCover: () => {
        if (draft.coverPreviewUrl) URL.revokeObjectURL(draft.coverPreviewUrl);
        setDraft((current) => ({
          ...current,
          coverBlob: null,
          coverPreviewUrl: null,
          coverPicked: false,
        }));
      },
    }),
    [draft, hostName, hostEmail, signedIn, restored],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftContextValue {
  const value = useContext(DraftContext);
  if (!value) throw new Error("useDraft must be used inside the wizard layout.");
  return value;
}

/** What the server action receives. Indices become the real numbers here, once. */
export function draftToInput(draft: Draft) {
  return {
    name: draft.name.trim(),
    startsAt: draft.startsAt.toISOString(),
    finishesAt: draft.finishesAt.toISOString(),
    revealMode: draft.revealMode,
    revealDelayHours: draft.revealMode === "DELAY" ? draft.delayHours : 0,
    maxGuests: PARTICIPANT_TIERS[draft.participantIndex],
    photosPerGuest: SHOT_TIERS[draft.shotIndex],
    everyoneCanSee: draft.everyoneCanSee,
    giveawayAllowed: draft.giveawayAllowed,
    uploadsAllowed: draft.uploadsAllowed,
    coverPreset: draft.coverPreset,
    referralCode: draft.referralCode.trim(),
  };
}
