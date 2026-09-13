"use client";

import type { RevealMode } from "@prisma/client";
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
  Photo,
  Trash,
} from "@/components/roll/Icons";
import { GiveawayHelp } from "@/components/roll/GiveawayHelp";
import { SettingRow } from "@/components/roll/SettingRow";
import { Sheet } from "@/components/roll/Sheet";
import { Toggle } from "@/components/roll/Toggle";
import { formatDateTime } from "@/lib/format";
import {
  GIVEAWAY_LABEL,
  GIVEAWAY_MIN_SHOTS,
  PARTICIPANT_TIERS,
  SHOT_TIERS,
  VISIBILITY_LABEL,
  shotsAvailable,
} from "@/lib/roll-config";

import {
  deleteRollAction,
  setGiveawayAction,
  setSizeAction,
  setVisibilityAction,
} from "../actions";

const REVEAL_LABEL = { DURING: "During", AFTER: "After", DELAY: "After + delay" } as const;

/** Every shot tier a host may pick today — the hundred is held back through the beta. */
const SHOTS = SHOT_TIERS.filter(shotsAvailable);

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
  giveawayAllowed: initialGiveaway,
}: {
  rollId: string;
  name: string;
  startsAt: Date;
  finishesAt: Date;
  revealMode: RevealMode;
  /** Whether the photographs are already legible. There is no way back from true. */
  open: boolean;
  /** Whether the event has not begun. Decided on the server, like the seal above it. */
  beforeStart: boolean;
  maxGuests: number;
  photosPerGuest: number;
  /** The floor under the guest limit: a cap cannot be set below the people already inside it. */
  guestCount: number;
  everyoneCanSee: boolean;
  giveawayAllowed: boolean;
}) {
  const router = useRouter();
  const [everyoneCanSee, setEveryoneCanSee] = useState(initialVisibility);
  const [giveaway, setGiveaway] = useState(initialGiveaway);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visibilityLabel = VISIBILITY_LABEL[everyoneCanSee ? "on" : "off"];
  const giveawayLabel = GIVEAWAY_LABEL[giveaway ? "on" : "off"];

  const toggleVisibility = (next: boolean) => {
    setEveryoneCanSee(next);
    startTransition(async () => {
      await setVisibilityAction(rollId, next);
      router.refresh();
    });
  };

  const toggleGiveaway = (next: boolean) => {
    setGiveaway(next);
    startTransition(async () => {
      await setGiveawayAction(rollId, next);
      router.refresh();
    });
  };

  // Not optimistic: the camera and the door read these numbers, so the row shows what the server holds.
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
          {/* Movable only until the event begins. */}
          <SettingRow
            icon={<CalendarIcon className="h-5 w-5" />}
            label="Start date"
            value={formatDateTime(startsAt)}
            href={beforeStart ? `/rolls/${rollId}/settings/start` : undefined}
          />
          {/* Movable while the roll is sealed. */}
          <SettingRow
            icon={<CalendarIcon className="h-5 w-5" />}
            label="Ending date"
            value={formatDateTime(finishesAt)}
            href={open ? undefined : `/rolls/${rollId}/settings/finish`}
          />
          {/* Opening early is choosing `DURING` on the screen this leads to. */}
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
            label={visibilityLabel}
            trailing={
              <Toggle on={everyoneCanSee} onChange={toggleVisibility} name={visibilityLabel} />
            }
          />

          {photosPerGuest >= GIVEAWAY_MIN_SHOTS ? (
            <SettingRow
              icon={<Photo className="h-5 w-5" />}
              label={giveawayLabel}
              after={<GiveawayHelp shots={photosPerGuest} />}
              trailing={<Toggle on={giveaway} onChange={toggleGiveaway} name={giveawayLabel} />}
            />
          ) : null}
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
 * A settings row stepping through a fixed list of tiers in place. Each end disables at the edge
 * of what is allowed, which is how the guest limit refuses to drop below the people inside.
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
