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

import { deleteRollAction, revealNowAction, setVisibilityAction } from "../actions";

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
  const [revealing, setRevealing] = useState(false);
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
          <SettingRow
            icon={<Clock className="h-5 w-5" />}
            label="Reveal time"
            value={REVEAL_LABEL[revealMode]}
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

        {/*
          Only while there is something still sealed. `revealNowAction` has existed since the
          reveal became its own moment and had no way to be reached, so a host who set the
          wrong time — or simply could not wait — had no recourse but to delete the roll.
        */}
        {open ? null : (
          <button
            type="button"
            onClick={() => setRevealing(true)}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-flame/10 text-[15px] font-medium text-flame transition-colors hover:bg-flame/15"
          >
            <LockOpen className="h-4 w-4" />
            Reveal now
          </button>
        )}

        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-danger/10 text-[15px] font-medium text-danger transition-colors hover:bg-danger/15"
        >
          <Trash className="h-4 w-4" />
          Delete
        </button>
      </Sheet>

      <Dialog
        open={revealing}
        title="Open the roll now?"
        onClose={() => setRevealing(false)}
        actions={
          <>
            <Pill variant="quiet" full disabled={pending} onClick={() => setRevealing(false)}>
              Cancel
            </Pill>
            <Pill
              variant="flame"
              full
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await revealNowAction(rollId);
                  setRevealing(false);
                  router.refresh();
                })
              }
            >
              {pending ? "Opening…" : "Reveal"}
            </Pill>
          </>
        }
      >
        Every guest sees every photograph they are allowed to, straight away. A roll cannot be
        sealed again once it has been opened.
      </Dialog>

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
