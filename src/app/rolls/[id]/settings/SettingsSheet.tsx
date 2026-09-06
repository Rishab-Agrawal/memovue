"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Pill } from "@/components/roll/Chrome";
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
import { visibilityLabel } from "@/lib/roll-config";

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
  open,
  everyoneCanSee: initialVisibility,
}: {
  rollId: string;
  name: string;
  startsAt: Date;
  finishesAt: Date;
  revealMode: "DURING" | "AFTER" | "DELAY";
  /** Whether the photographs are already legible. There is no way back from true. */
  open: boolean;
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
      <Sheet back={`/rolls/${rollId}`} title="Roll Settings">
        <div className="mt-5">
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
          {/*
            The only date a host may move, and only while the roll is sealed. Events run late;
            the shutter used to close on the schedule regardless, with nothing on this screen
            to say otherwise. Once the album is open there is nothing here left to change.
          */}
          <SettingRow
            icon={<CalendarIcon className="h-5 w-5" />}
            label="Ending date"
            value={formatDateTime(finishesAt)}
            href={open ? undefined : `/rolls/${rollId}/settings/finish`}
          />
          {/*
            The reveal itself, not a button beside it. This row printed the mode as a fact and
            the only thing a host could do about it was a "Reveal now" button underneath that
            opened the roll for good — so someone who had simply picked the wrong option at
            creation had one irreversible move available and no way to make a smaller one.
            Opening early is `DURING` on the screen this leads to, which is the same screen
            they chose the mode on.
          */}
          <SettingRow
            icon={<Clock className="h-5 w-5" />}
            label="Reveal time"
            value={REVEAL_LABEL[revealMode]}
            href={open ? undefined : `/rolls/${rollId}/settings/reveal`}
          />

          <SettingRow
            icon={everyoneCanSee ? <LockOpen className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            label={visibilityLabel(everyoneCanSee)}
            trailing={
              <Toggle
                on={everyoneCanSee}
                onChange={toggleVisibility}
                name={visibilityLabel(everyoneCanSee)}
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
        onClose={() => setConfirming(false)}
        actions={
          <>
            <Pill variant="quiet" full disabled={pending} onClick={() => setConfirming(false)}>
              Cancel
            </Pill>
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
