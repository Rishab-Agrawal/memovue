"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { DatePick } from "@/components/roll/DatePick";
import { EditScreen } from "@/components/roll/EditScreen";
import { formatDateTime } from "@/lib/format";
import { movedStart, startDateRange } from "@/lib/roll-config";
import { useNow } from "@/lib/useNow";

import { updateStartAction } from "../../actions";

/** Moving the opening time of a roll that has not begun. The close moves with it when it must, and the copy says so. */
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
  // Zero until mounted, keeping the floor out of the server render.
  const now = useNow();

  // Never into the past. Before mount, today's start of day stands in for now.
  const range = startDateRange();
  const floor = new Date(Math.max(range.min.getTime(), now));
  const dirty = startsAt.getTime() !== initialStart.getTime();
  // The same function the server uses, so the preview line matches what will be saved.
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
    <EditScreen
      rollId={rollId}
      title="When does it start?"
      blurb="Guests can shoot from this moment. Nobody has taken a photograph yet, so this can still move."
      dirty={dirty}
      saving={pending}
      error={error}
      onSave={save}
    >
      <div className="mt-8">
        {/* The range starts at the floor, so past days render disabled. */}
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
    </EditScreen>
  );
}
