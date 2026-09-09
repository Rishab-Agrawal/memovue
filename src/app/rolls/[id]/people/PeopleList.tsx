"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Pill } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";
import { Trash } from "@/components/roll/Icons";
import { PersonRow } from "@/components/roll/PersonRow";
import { PARTICIPANT_TIERS } from "@/lib/roll-config";

import { removeGuestAction, setSizeAction } from "../actions";

export interface Participant {
  id: string;
  name: string;
  shotsUsed: number;
  /** Whoever is reading this screen. They hold film like everybody else, and cannot be removed. */
  isHost: boolean;
}

/**
 * Who turned up, how much film they have spent, and the two things a host needs to be able to
 * do about it.
 *
 * **Removing somebody.** The join link is a bearer token with no expiry — anyone who
 * photographs the QR on a table is in — and nothing could undo that. Their photographs go
 * with them, which is the point: a guest is removed because of what they shot.
 *
 * **Raising the limit**, and only once the roll has actually filled. A cap reached mid-event
 * turns people away at the door, and until now the host had no lever at all — the row that
 * would have raised it was left out of the settings sheet because the reference sold it as an
 * upgrade. Offered here rather than there because this is the screen that shows the number
 * running out.
 */
export function PeopleList({
  rollId,
  people,
  maxGuests,
}: {
  rollId: string;
  people: Participant[];
  maxGuests: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  /** Who is being removed, and the box asking about it. Null when there is no question open. */
  const [confirming, setConfirming] = useState<Participant | null>(null);

  const full = people.length >= maxGuests;
  const nextTier = PARTICIPANT_TIERS.find((tier) => tier > maxGuests);

  const run = (work: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <ul className="mt-5 divide-y divide-hair border-t border-hair">
        {people.map((person) => (
          <PersonRow
            key={person.id}
            person={person}
            hostSuffix="you"
            /* The host's own row keeps the list honest about who holds film, and offers
               nothing: removing yourself from your own roll deletes your photographs and
               hands your slot back to an event you own. */
            action={
              person.isHost ? null : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirming(person)}
                  aria-label={`Remove ${person.name}`}
                  className="tap shrink-0 text-dust transition-colors hover:text-danger disabled:opacity-40"
                >
                  <Trash className="h-4 w-4" />
                </button>
              )
            }
          />
        ))}
      </ul>

      {/* A roll whose only participant is the host has had nobody turn up yet, whatever the
          list above shows. */}
      {people.every((person) => person.isHost) ? (
        <p className="mt-5 text-[15px] text-dust">
          Nobody else has joined yet. Share the QR code and they&rsquo;ll appear here.
        </p>
      ) : null}

      {full ? (
        <div className="mt-6 rounded-2xl bg-page px-4 py-4">
          <p className="text-[14px] leading-relaxed text-ash">
            This roll is full. Anyone else who scans the code will be turned away.
          </p>
          {nextTier ? (
            <Pill
              variant="flame"
              full
              className="mt-3"
              disabled={pending}
              onClick={() => run(() => setSizeAction(rollId, { maxGuests: nextTier }))}
            >
              {pending ? "Raising…" : `Raise the limit to ${nextTier}`}
            </Pill>
          ) : (
            <p className="mt-2 text-[13px] text-dust">
              {maxGuests} is the largest a roll goes.
            </p>
          )}
        </div>
      ) : null}

      {error ? <p className="mt-4 text-[14px] text-danger">{error}</p> : null}

      {/* The browser's own confirm box was the one piece of chrome in the product drawn by
          somebody else — system font, system buttons, and no way to say what is about to be
          deleted in our own words. Same card, same danger pill as deleting a roll. */}
      <Dialog
        open={confirming !== null}
        title={`Remove ${confirming?.name}?`}
        onClose={() => setConfirming(null)}
        actions={
          <>
            <Pill variant="quiet" full disabled={pending} onClick={() => setConfirming(null)}>
              Cancel
            </Pill>
            <Pill
              full
              disabled={pending}
              className="bg-danger text-void hover:bg-danger"
              onClick={() => {
                const person = confirming;
                if (!person) return;
                setConfirming(null);
                run(() => removeGuestAction(rollId, person.id));
              }}
            >
              {pending ? "Removing…" : "Remove"}
            </Pill>
          </>
        }
      >
        {confirming?.shotsUsed === 1
          ? "Their photograph will be permanently deleted and cannot be recovered."
          : `Their ${confirming?.shotsUsed ?? 0} photographs will be permanently deleted and cannot be recovered.`}
      </Dialog>
    </>
  );
}
