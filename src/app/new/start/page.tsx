"use client";

import { DateStep } from "../DateStep";
import { useDraft } from "../DraftContext";

import { startDateRange } from "@/lib/roll-config";

/**
 * The step the reference does not have.
 *
 * Its rolls open the moment they are created, so it only ever asks when the event finishes.
 * A host printing a QR code two weeks before a wedding needs the roll to exist now and open
 * then, which is what this step is for. Bounded to two years out, because weddings get
 * booked that far ahead and nothing legitimate goes further.
 */
export default function StepStart() {
  const { draft, update } = useDraft();

  return (
    <DateStep
      step={2}
      title="When does your event start?"
      subtitle="Guests can start capturing photos from this moment."
      back="/new/name"
      nextHref="/new/finish"
      value={draft.startsAt}
      onChange={(startsAt) => update({ startsAt })}
      range={startDateRange()}
    />
  );
}
