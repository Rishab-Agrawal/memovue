"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Pill, PillLink } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";
import { Calendar as CalendarIcon, Clock, Lock, LockOpen, Pencil, Trash } from "@/components/roll/Icons";
import { SettingRow } from "@/components/roll/SettingRow";
import { Sheet } from "@/components/roll/Sheet";
import { Toggle } from "@/components/roll/Toggle";
import { formatDateTime } from "@/lib/format";
import { ROLL } from "@/lib/mock-REMOVED";
import { RollBackdrop } from "../RollBackdrop";

const REVEAL_LABEL = { during: "During", after: "After", delay: "After + delay" } as const;

/**
 * The reference carries two more rows here — Participants and Shots per person — both of
 * which open paid upgrades. We sell neither, and changing the shot count mid-roll would
 * retroactively change what guests were promised, so both are gone.
 */
export default function RollSettings() {
  const confirming = useSearchParams().get("v") === "delete";
  const [everyoneCanSee, setEveryoneCanSee] = useState(ROLL.everyoneCanSee);

  return (
    <div className="relative min-h-full">
      <RollBackdrop />

      <Sheet title="Roll Settings">
        <div className="mt-5 space-y-2">
          <SettingRow
            icon={<Pencil className="h-5 w-5" />}
            label="Name & Cover"
            value={ROLL.title}
            href="/proto/roll/settings/info"
          />
          <SettingRow
            icon={<CalendarIcon className="h-5 w-5" />}
            label="Start date"
            value={formatDateTime(ROLL.startAt)}
            href="/proto/new/start"
          />
          <SettingRow
            icon={<CalendarIcon className="h-5 w-5" />}
            label="Ending date"
            value={formatDateTime(ROLL.finishAt)}
            href="/proto/new/finish"
          />
          <SettingRow
            icon={<Clock className="h-5 w-5" />}
            label="Reveal time"
            value={REVEAL_LABEL[ROLL.revealMode]}
            href="/proto/new/reveal"
          />

          <SettingRow
            icon={
              everyoneCanSee ? <LockOpen className="h-5 w-5" /> : <Lock className="h-5 w-5" />
            }
            label="Everyone can see all photos"
            trailing={
              <Toggle
                on={everyoneCanSee}
                onChange={setEveryoneCanSee}
                name="Everyone can see all photos"
              />
            }
          />
        </div>

        <PillLink
          href="/proto/roll/settings?v=delete"
          full
          className="mt-6 border-0 bg-danger/10 text-danger hover:text-danger"
        >
          <Trash className="h-4 w-4" />
          Delete
        </PillLink>
      </Sheet>

      <Dialog
        open={confirming}
        title="Delete this roll?"
        actions={
          <>
            <PillLink href="/proto/roll/settings" variant="quiet" full>
              Cancel
            </PillLink>
            <Pill full className="bg-danger text-void hover:bg-danger">
              Delete
            </Pill>
          </>
        }
      >
        Every photo in it will be permanently deleted and cannot be recovered.
      </Dialog>
    </div>
  );
}
