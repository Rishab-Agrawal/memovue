"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { Pill, StepButton } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";
import {
  Calendar as CalendarIcon,
  Camera,
  Clock,
  Lock,
  LockOpen,
  Pencil,
  Person,
  Trash,
} from "@/components/roll/Icons";
import { SettingRow } from "@/components/roll/SettingRow";
import { Sheet } from "@/components/roll/Sheet";
import { Toggle } from "@/components/roll/Toggle";
import { formatDateTime } from "@/lib/format";
import { PARTICIPANT_TIERS, SHOT_TIERS, shotsAvailable, visibilityLabel } from "@/lib/roll-config";

import { deleteRollAction, setSizeAction, setVisibilityAction } from "../actions";

const REVEAL_LABEL = { DURING: "During", AFTER: "After", DELAY: "After + delay" } as const;

/** Every shot tier a host may pick today — the hundred is held back through the beta. */
const SHOTS = SHOT_TIERS.filter(shotsAvailable);

/**
 * The reference sells the size of a roll here as two paid upgrades. We sell neither, so both
 * rows step through the tiers in place rather than leading anywhere: the whole interaction is
 * one tap, and a sub-screen for a number with six values would be a screen to explain nothing.
 */
export function SettingsSheet({
  rollId,
  name,
  startsAt,
  finishesAt,
  revealMode,
  open,
  beforeStart,
  maxGuests,
  photosPerGuest,
  guestCount,
  everyoneCanSee: initialVisibility,
}: {
  rollId: string;
  name: string;
  startsAt: Date;
  finishesAt: Date;
  revealMode: "DURING" | "AFTER" | "DELAY";
  /** Whether the photographs are already legible. There is no way back from true. */
  open: boolean;
  /** Whether the event has not begun. Decided on the server, like the seal above it. */
  beforeStart: boolean;
  maxGuests: number;
  photosPerGuest: number;
  /** The floor under the guest limit: a cap cannot be set below the people already inside it. */
  guestCount: number;
  everyoneCanSee: boolean;
}) {
  const router = useRouter();
  const [everyoneCanSee, setEveryoneCanSee] = useState(initialVisibility);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggleVisibility = (next: boolean) => {
    setEveryoneCanSee(next);
    startTransition(async () => {
      await setVisibilityAction(rollId, next);
      router.refresh();
    });
  };

  /*
    Written straight through rather than held in local state first. These two numbers are read
    back by the camera and by the door, and a row that showed a new figure while the server
    still held the old one would be the one place in the app where a host's own settings lie
    to them.
  */
  const resize = (next: { maxGuests?: number; photosPerGuest?: number }) => {
    setError(null);
    startTransition(async () => {
      const result = await setSizeAction(rollId, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
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
          {/*
            Movable only until the event begins. After that the start is history: guests are
            mid-roll with cameras that would change under them, and a start pushed back into
            the future would make a shot roll look unstarted to everything that reads it —
            including the refund on deletion.
          */}
          <SettingRow
            icon={<CalendarIcon className="h-5 w-5" />}
            label="Start date"
            value={formatDateTime(startsAt)}
            href={beforeStart ? `/rolls/${rollId}/settings/start` : undefined}
          />
          {/*
            Movable while the roll is sealed. Events run late; the shutter used to close on the
            schedule regardless, with nothing on this screen to say otherwise. Once the album is
            open there is nothing here left to change.
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

          <TierRow
            icon={<Person className="h-5 w-5" />}
            label="Guests"
            noun="guests"
            tiers={PARTICIPANT_TIERS}
            value={maxGuests}
            // Never below the people already standing in the roll.
            floor={guestCount}
            pending={pending}
            onPick={(next) => resize({ maxGuests: next })}
          />
          <TierRow
            icon={<Camera className="h-5 w-5" />}
            label="Shots each"
            noun="shots"
            tiers={SHOTS}
            value={photosPerGuest}
            pending={pending}
            onPick={(next) => resize({ photosPerGuest: next })}
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

        {error ? <p className="mt-4 text-[14px] text-danger">{error}</p> : null}

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

/**
 * A settings row whose value is one of a handful of tiers, stepped in place.
 *
 * The tiers are a price list, not a range, so this walks the list rather than offering a
 * number field — there is no legal value between two of them to type. Both ends disable at
 * the edge of what is allowed, which is how the guest limit refuses to drop below the people
 * already inside it without needing a sentence to explain itself.
 */
function TierRow({
  icon,
  label,
  noun,
  tiers,
  value,
  floor,
  pending,
  onPick,
}: {
  icon: ReactNode;
  label: string;
  /** For the two buttons' labels, which are all a screen reader gets of this control. */
  noun: string;
  tiers: readonly number[];
  value: number;
  /** The smallest tier that may be chosen, when something already commits the roll to it. */
  floor?: number;
  pending: boolean;
  onPick: (next: number) => void;
}) {
  const index = tiers.indexOf(value);
  const down = index > 0 ? tiers[index - 1] : undefined;
  const up = index >= 0 && index < tiers.length - 1 ? tiers[index + 1] : undefined;

  return (
    <SettingRow
      icon={icon}
      label={label}
      trailing={
        <span className="flex items-center gap-2.5">
          <StepButton
            small
            label={`Fewer ${noun}`}
            glyph="−"
            disabled={pending || down === undefined || (floor !== undefined && down < floor)}
            onClick={() => onPick(down!)}
          />
          <span aria-live="polite" className="tabular w-9 text-center text-[15px] text-chalk">
            {value}
          </span>
          <StepButton
            small
            label={`More ${noun}`}
            glyph="+"
            disabled={pending || up === undefined}
            onClick={() => onPick(up!)}
          />
        </span>
      }
    />
  );
}
