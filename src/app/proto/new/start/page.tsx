"use client";

import { DateStep } from "../DateStep";
import { useDraft } from "../DraftContext";
import { NOW } from "../../mock";
import { startDateRange } from "../../rules";

/**
 * The step the reference does not have.
 *
 * Its films open the moment they are created, so it only ever asks when the event finishes.
 * A host printing a QR code two weeks before a wedding needs the film to exist now and open
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
      back="/proto/new/name"
      nextHref="/proto/new/finish"
      value={draft.startAt}
      onChange={(startAt) => update({ startAt })}
      range={startDateRange(NOW)}
    />
  );
}
