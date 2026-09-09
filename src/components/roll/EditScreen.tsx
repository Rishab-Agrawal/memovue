"use client";

import type { ReactNode } from "react";

import { Pill } from "@/components/roll/Chrome";
import { EditBackButton } from "@/components/roll/Confirm";

/**
 * One setting of a roll, on a screen of its own.
 *
 * The four of these — title and cover, start, finish, reveal — were the same screen four
 * times: the same column, the same back button guarding the same unsaved changes, the same
 * centred heading, the same refusal printed in the same red, and the same Save pill pinned to
 * the bottom by the same spacer. `WizardShell` already does this job for the six steps of
 * creation; this is its half-sibling for the screens that come after.
 *
 * `disabled` exists because one of the four does not agree about when Save is dead: the info
 * screen is also busy while a cover is being resized, which is not a transition and is not
 * dirtiness either. The other three take the default.
 */
export function EditScreen({
  rollId,
  title,
  blurb,
  dirty,
  saving,
  disabled,
  error,
  onSave,
  children,
}: {
  rollId: string;
  title: string;
  blurb?: ReactNode;
  /** Whether there is anything to save — asked twice: by the button, and on the way out. */
  dirty: boolean;
  saving: boolean;
  disabled?: boolean;
  /** Omit where the screen prints its own refusal somewhere more useful. */
  error?: string | null;
  onSave: () => void;
  children: ReactNode;
}) {
  return (
    <div className="pad-safe-top flex min-h-dvh flex-col px-5 pb-[calc(var(--safe-bottom)+1.5rem)]">
      <EditBackButton href={`/rolls/${rollId}/settings`} dirty={dirty} />

      <h1 className="display mt-5 text-center text-[30px] text-chalk">{title}</h1>
      {blurb ? <p className="mt-3 text-center text-[15px] text-ash">{blurb}</p> : null}

      {children}

      {error ? <p className="mt-4 text-center text-[14px] text-danger">{error}</p> : null}

      <div className="flex-1" />

      <Pill
        variant="light"
        full
        className="mt-8"
        disabled={disabled ?? (saving || !dirty)}
        onClick={onSave}
      >
        {saving ? "Saving…" : "Save"}
      </Pill>
    </div>
  );
}
