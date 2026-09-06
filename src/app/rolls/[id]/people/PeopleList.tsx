"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Pill } from "@/components/roll/Chrome";
import { Trash } from "@/components/roll/Icons";
import { PARTICIPANT_TIERS } from "@/lib/roll-config";

import { removeGuestAction, setSizeAction } from "../actions";

export interface Participant {
  id: string;
  name: string;
  shotsUsed: number;
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

  const remove = (person: Participant) => {
    const photos = person.shotsUsed === 1 ? "1 photograph" : `${person.shotsUsed} photographs`;
    if (
      !window.confirm(
        `Remove ${person.name} from this roll? Their ${photos} will be deleted and cannot be recovered.`,
      )
    ) {
      return;
    }
    run(() => removeGuestAction(rollId, person.id));
  };

  if (people.length === 0) {
    return (
      <p className="mt-6 text-[15px] text-dust">
        Nobody has joined yet. Share the QR code and they&rsquo;ll appear here.
      </p>
    );
  }

  return (
    <>
      <ul className="mt-5 divide-y divide-hair border-t border-hair">
        {people.map((person) => (
          <li key={person.id} className="flex items-center gap-3 py-4">
            <span className="flex-1 truncate text-[15px] text-chalk">{person.name}</span>
            <span className="tabular text-[13px] text-dust">{person.shotsUsed} shots used</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => remove(person)}
              aria-label={`Remove ${person.name}`}
              className="tap shrink-0 text-dust transition-colors hover:text-danger disabled:opacity-40"
            >
              <Trash className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

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
    </>
  );
}
