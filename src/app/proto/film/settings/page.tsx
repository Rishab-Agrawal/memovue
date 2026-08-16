"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Pill, PillLink } from "../../components/Chrome";
import { Dialog } from "../../components/Dialog";
import { Calendar as CalendarIcon, Clock, Lock, LockOpen, Pencil, Trash } from "../../components/Icons";
import { SettingRow } from "../../components/SettingRow";
import { Sheet } from "../../components/Sheet";
import { Toggle } from "../../components/Toggle";
import { formatDateTime } from "../../format";
import { FILM } from "../../mock";
import { FilmBackdrop } from "../FilmBackdrop";

const REVEAL_LABEL = { during: "During", after: "After", delay: "After + delay" } as const;

/**
 * The reference carries two more rows here — Participants and Shots per person — both of
 * which open paid upgrades. We sell neither, and changing the shot count mid-film would
 * retroactively change what guests were promised, so both are gone.
 */
export default function FilmSettings() {
  const confirming = useSearchParams().get("v") === "delete";
  const [everyoneCanSee, setEveryoneCanSee] = useState(FILM.everyoneCanSee);

  return (
    <div className="relative min-h-full">
      <FilmBackdrop />

      <Sheet title="Film Settings">
        <div className="mt-5 space-y-2">
          <SettingRow
            icon={<Pencil className="h-5 w-5" />}
            label="Name & Cover"
            value={FILM.title}
            href="/proto/film/settings/info"
          />
          <SettingRow
            icon={<CalendarIcon className="h-5 w-5" />}
            label="Start date"
            value={formatDateTime(FILM.startAt)}
            href="/proto/new/start"
          />
          <SettingRow
            icon={<CalendarIcon className="h-5 w-5" />}
            label="Ending date"
            value={formatDateTime(FILM.finishAt)}
            href="/proto/new/finish"
          />
          <SettingRow
            icon={<Clock className="h-5 w-5" />}
            label="Reveal time"
            value={REVEAL_LABEL[FILM.revealMode]}
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
          href="/proto/film/settings?v=delete"
          full
          className="mt-6 border-0 bg-danger/10 text-danger hover:text-danger"
        >
          <Trash className="h-4 w-4" />
          Delete
        </PillLink>
      </Sheet>

      <Dialog
        open={confirming}
        title="Delete this film?"
        actions={
          <>
            <PillLink href="/proto/film/settings" variant="quiet" full>
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
