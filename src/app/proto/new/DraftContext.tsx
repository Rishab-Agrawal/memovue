"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { COVER_PRESETS, DRAFT_DEFAULTS, ROLL } from "../mock";
import type { RevealMode } from "../rules";

/**
 * The roll being created, shared across the six wizard steps.
 *
 * This lives in the wizard's layout rather than in each page because App Router layouts keep
 * their state across navigations between the routes they wrap — so stepping forward and back
 * carries the draft with it, which is the only way to tell whether the step order actually
 * works.
 */
export interface Draft {
  title: string;
  startAt: Date;
  finishAt: Date;
  revealMode: RevealMode;
  delayHours: number;
  coverIndex: number;
  participantIndex: number;
  shotIndex: number;
  everyoneCanSee: boolean;
}

type DraftContextValue = {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
};

const DraftContext = createContext<DraftContextValue | null>(null);

const initial: Draft = {
  title: DRAFT_DEFAULTS.title,
  startAt: DRAFT_DEFAULTS.startAt,
  finishAt: DRAFT_DEFAULTS.finishAt,
  revealMode: ROLL.revealMode,
  delayHours: ROLL.revealDelayHours,
  coverIndex: COVER_PRESETS[0],
  participantIndex: ROLL.participantIndex,
  shotIndex: ROLL.shotIndex,
  everyoneCanSee: ROLL.everyoneCanSee,
};

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(initial);

  const value = useMemo(
    () => ({
      draft,
      update: (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch })),
    }),
    [draft],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftContextValue {
  const value = useContext(DraftContext);
  if (!value) throw new Error("useDraft must be used inside the wizard layout.");
  return value;
}
