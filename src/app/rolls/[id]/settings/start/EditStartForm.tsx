"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Pill } from "@/components/roll/Chrome";
import { EditBackButton } from "@/components/roll/Confirm";
import { DatePick } from "@/components/roll/DatePick";
import { formatDateTime } from "@/lib/format";
import { movedStart, startDateRange } from "@/lib/roll-config";
import { useNow } from "@/lib/useNow";

import { updateStartAction } from "../../actions";

/**
 * Moving the opening time of a roll whose event has not begun.
 *
 * A host printing QR codes two weeks ahead is exactly the person who has to move a date, and
 * the wedding that shifts by a day is the ordinary case rather than the strange one. What
 * makes it safe is the window: before the first moment nobody has taken a photograph, so
 * there is no camera to change under anyone and nothing derived from the start to unpick.
 *
 * The finish comes along when it has to — `clampFinish` is the same pairing rule the wizard
 * runs on every keystroke — so the copy says so rather than letting a host find out afterwards.
 */
export function EditStartForm({
  rollId,
  startsAt: initialStart,
  finishesAt,
}: {
  rollId: string;
  startsAt: Date;
  finishesAt: Date;
}) {
  const router = useRouter();
  const [startsAt, setStartsAt] = useState(initialStart);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Zero until mounted, which is what keeps the floor below out of the server render and off
  // the hydration diff. It corrects on the microtask after mount, and ticks after that.
  const now = useNow();

  /*
    Never into the past: a start behind the present is a roll that opened at a moment nobody
    could have shot in. Pulling it forward as far as now is the "we're starting early" edit.
    Before mount `now` is 0, so the day the calendar opens on stands in — the same value on
    both sides of hydration, and past by at most one day's worth of hours.
  */
  const range = startDateRange();
  const floor = new Date(Math.max(range.min.getTime(), now));
  const dirty = startsAt.getTime() !== initialStart.getTime();
  // What the server would settle on, asked of the same function the server asks, so the line
  // below is the truth rather than a guess at it.
  const closes = movedStart({ startsAt: initialStart, finishesAt }, startsAt, floor)?.finishesAt;

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateStartAction(rollId, startsAt.toISOString());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/rolls/${rollId}/settings`);
      router.refresh();
    });
  };

  return (
    <div className="pad-safe-top flex min-h-dvh flex-col px-5 pb-[calc(var(--safe-bottom)+1.5rem)]">
      <EditBackButton href={`/rolls/${rollId}/settings`} dirty={dirty} />

      <h1 className="display mt-5 text-center text-[30px] text-chalk">When does it start?</h1>
      <p className="mt-3 text-center text-[15px] text-ash">
        Guests can shoot from this moment. Nobody has taken a photograph yet, so this can still
        move.
      </p>

      <div className="mt-8">
        {/* The range starts at the floor, not at today, so a day already gone renders as dead
            text rather than as a tap that silently jumps to now. */}
        <DatePick
          value={startsAt}
          onChange={setStartsAt}
          range={{ min: floor, max: range.max }}
          notBefore={floor}
        />
      </div>

      <p className="mt-6 text-center text-[13px] text-dust">
        {!closes || closes.getTime() === finishesAt.getTime()
          ? `Finishes ${formatDateTime(finishesAt)}`
          : `The close moves with it, to ${formatDateTime(closes)}`}
      </p>

      {error ? <p className="mt-4 text-center text-[14px] text-danger">{error}</p> : null}

      <div className="flex-1" />

      <Pill variant="light" full className="mt-8" disabled={pending || !dirty} onClick={save}>
        {pending ? "Saving…" : "Save"}
      </Pill>
    </div>
  );
}
