"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Pill, PillLink } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";
import {
  Calendar as CalendarIcon,
  Clock,
  Lock,
  LockOpen,
  Pencil,
  Trash,
} from "@/components/roll/Icons";
import { SettingRow } from "@/components/roll/SettingRow";
import { Sheet } from "@/components/roll/Sheet";
import { Toggle } from "@/components/roll/Toggle";
import { formatDateTime } from "@/lib/format";

import { deleteRollAction, setVisibilityAction } from "../actions";

const REVEAL_LABEL = { DURING: "During", AFTER: "After", DELAY: "After + delay" } as const;

/**
 * The reference carries two more rows here — Participants and Shots per person — both of
 * which open paid upgrades. We sell neither, and raising the shot count mid-roll would
 * retroactively change what guests were told they had, so both are gone.
 */
export function SettingsSheet({
  rollId,
  name,
  startsAt,
  finishesAt,
  revealMode,
  everyoneCanSee: initialVisibility,
}: {
  rollId: string;
  name: string;
  startsAt: Date;
  finishesAt: Date;
  revealMode: "DURING" | "AFTER" | "DELAY";
  everyoneCanSee: boolean;
}) {
  const router = useRouter();
  const [everyoneCanSee, setEveryoneCanSee] = useState(initialVisibility);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggleVisibility = (next: boolean) => {
    setEveryoneCanSee(next);
    startTransition(async () => {
      await setVisibilityAction(rollId, next);
      router.refresh();
    });
  };

  return (
    <>
      <Sheet title="Roll Settings">
        <div className="mt-5 space-y-2">
          <SettingRow
            icon={<Pencil className="h-5 w-5" />}
            label="Name & Cover"
            value={name}
            href={`/rolls/${rollId}/settings/info`}
          />
          <SettingRow
            icon={<CalendarIcon className="h-5 w-5" />}
            label="Start date"
            value={formatDateTime(startsAt)}
          />
          <SettingRow
            icon={<CalendarIcon className="h-5 w-5" />}
            label="Ending date"
            value={formatDateTime(finishesAt)}
          />
          <SettingRow
            icon={<Clock className="h-5 w-5" />}
            label="Reveal time"
            value={REVEAL_LABEL[revealMode]}
          />

          <SettingRow
            icon={everyoneCanSee ? <LockOpen className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            label="Everyone can see all photos"
            trailing={
              <Toggle
                on={everyoneCanSee}
                onChange={toggleVisibility}
                name="Everyone can see all photos"
              />
            }
          />
        </div>

        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-danger/10 text-[15px] font-medium text-danger transition-colors hover:bg-danger/15"
        >
          <Trash className="h-4 w-4" />
          Delete
        </button>
      </Sheet>

      <Dialog
        open={confirming}
        title="Delete this roll?"
        actions={
          <>
            <PillLink href={`/rolls/${rollId}/settings`} variant="quiet" full>
              Cancel
            </PillLink>
            <Pill
              full
              disabled={pending}
              className="bg-danger text-void hover:bg-danger"
              onClick={() => startTransition(() => void deleteRollAction(rollId))}
            >
              {pending ? "Deleting…" : "Delete"}
            </Pill>
          </>
        }
      >
        Every photo in it will be permanently deleted and cannot be recovered.
      </Dialog>
    </>
  );
}
