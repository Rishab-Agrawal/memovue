"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { DatePick } from "@/components/roll/DatePick";
import { EditScreen } from "@/components/roll/EditScreen";
import { formatDateTime } from "@/lib/format";
import { clampFinish, earliestFinish, finishDateRange } from "@/lib/roll-config";
import { useNow } from "@/lib/useNow";

import { updateFinishAction } from "../../actions";

/** Moving the closing time of a sealed roll. The reveal and deletion date move with it, and the copy says so. */
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
  // Zero until mounted, keeping the floor out of the server render.
  const now = useNow();

  // Never into the past: on an `AFTER` roll a backdated close would unseal the album.
  const floor = new Date(Math.max(earliestFinish(startsAt).getTime(), now));
  const dirty = finishesAt.getTime() !== initialFinish.getTime();

  const save = () => {
    setError(null);
    startTransition(async () => {
      // The server clamps again against the row; the likely error is a roll that opened meanwhile.
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
    <EditScreen
      rollId={rollId}
      title="When does it finish?"
      blurb="Guests can shoot until this moment. When the album opens, and how long the photographs are kept, both move with it."
      dirty={dirty}
      saving={pending}
      error={error}
      onSave={save}
    >
      <div className="mt-8">
        {/* The range starts at the floor, so past days render disabled. */}
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
    </EditScreen>
  );
}
