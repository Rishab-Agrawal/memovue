"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Pill } from "@/components/roll/Chrome";
import { EditBackButton } from "@/components/roll/Confirm";
import { DatePick } from "@/components/roll/DatePick";
import { formatDateTime } from "@/lib/format";
import { clampFinish, earliestFinish, finishDateRange } from "@/lib/roll-config";
import { useNow } from "@/lib/useNow";

import { updateFinishAction } from "../../actions";

/**
 * Moving the closing time of a roll that is still sealed.
 *
 * The one control a host could not touch after creation, printed on the settings sheet as a
 * fact about their own event. Parties run late and the shutter closed anyway; the only lever
 * left was revealing early, which is the opposite of what somebody still shooting wants.
 *
 * The reveal and the deletion date both hang off this, so the copy says so — a host moving a
 * close by two hours is also moving when the album opens, and finding that out afterwards is
 * finding it out too late.
 */
export function EditFinishForm({
  rollId,
  startsAt,
  finishesAt: initialFinish,
}: {
  rollId: string;
  startsAt: Date;
  finishesAt: Date;
}) {
  const router = useRouter();
  const [finishesAt, setFinishesAt] = useState(initialFinish);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Zero until mounted, which is what keeps the floor below out of the server render and off
  // the hydration diff. It corrects on the microtask after mount, and ticks after that.
  const now = useNow();

  /*
    Never into the past, which the wizard's version of this floor does not have to think about.
    On an `AFTER` roll the close *is* the reveal, so a finish backdated to this morning would
    unseal a whole afternoon of photographs on one mistyped date — the thing the settings sheet
    puts behind a confirm dialog and calls irreversible. Pulling the close in is still allowed,
    as far as the present and no further, which is the legitimate "we're wrapping up" edit.
  */
  const floor = new Date(Math.max(earliestFinish(startsAt).getTime(), now));
  const dirty = finishesAt.getTime() !== initialFinish.getTime();

  const save = () => {
    setError(null);
    startTransition(async () => {
      // Clamped on the way out as well as in the picker. The server does this again against
      // the row itself, so the only error worth showing here is a roll that opened while this
      // screen was sitting there.
      const result = await updateFinishAction(
        rollId,
        clampFinish(startsAt, finishesAt).toISOString(),
      );
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

      <h1 className="display mt-5 text-center text-[30px] text-chalk">When does it finish?</h1>
      <p className="mt-3 text-center text-[15px] text-ash">
        Guests can shoot until this moment. When the album opens, and how long the photographs
        are kept, both move with it.
      </p>

      <div className="mt-8">
        {/* The range starts at the floor, not at the roll's own start, so a day already gone
            renders as dead text rather than as a tap that silently jumps to now. */}
        <DatePick
          value={finishesAt}
          onChange={setFinishesAt}
          range={{ min: floor, max: finishDateRange(startsAt).max }}
          notBefore={floor}
        />
      </div>

      <p className="mt-6 text-center text-[13px] text-dust">
        Started {formatDateTime(startsAt)}
      </p>

      {error ? <p className="mt-4 text-center text-[14px] text-danger">{error}</p> : null}

      <div className="flex-1" />

      <Pill variant="light" full className="mt-8" disabled={pending || !dirty} onClick={save}>
        {pending ? "Saving…" : "Save"}
      </Pill>
    </div>
  );
}
