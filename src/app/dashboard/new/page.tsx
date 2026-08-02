"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { ChipGroup, TextField, Toggle } from "@/components/ui/Field";
import { Slider } from "@/components/ui/Slider";
import {
  EVENT_TYPES,
  GUEST_COUNT_OPTIONS,
  MAX_PHOTOS_PER_GUEST,
  MIN_PHOTOS_PER_GUEST,
  REVEAL_OPTIONS,
  eventTypeConfig,
} from "@/lib/event-types";

import { type ActionState, createEventAction } from "../actions";

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" in the viewer's own timezone. */
function toLocalInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function defaultStart(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(18, 0, 0, 0);
  return toLocalInputValue(date);
}

export default function NewEventPage() {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("WEDDING");
  const [partnerA, setPartnerA] = useState("");
  const [partnerB, setPartnerB] = useState("");
  const [honoreeName, setHonoreeName] = useState("");
  const [askRelation, setAskRelation] = useState(true);
  const [maxGuests, setMaxGuests] = useState<number>(100);
  const [photosPerGuest, setPhotosPerGuest] = useState(15);
  const [startsAt, setStartsAt] = useState("");
  const [revealDelayHours, setRevealDelayHours] = useState<number>(12);

  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();

  // Set on the client only: the server renders in UTC and would mismatch on hydration.
  useEffect(() => setStartsAt(defaultStart()), []);

  const config = eventTypeConfig(type as never);
  const relationMode = config.relation;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState({});

    startTransition(async () => {
      const result = await createEventAction({
        name,
        type,
        partnerA: relationMode === "sides" ? partnerA : undefined,
        partnerB: relationMode === "sides" ? partnerB : undefined,
        honoreeName: relationMode === "honoree" ? honoreeName : undefined,
        askRelation: relationMode === "none" ? false : askRelation,
        maxGuests,
        photosPerGuest,
        startsAt: startsAt ? new Date(startsAt).toISOString() : "",
        revealDelayHours,
      });
      // A successful create redirects, so anything returned here is a failure.
      if (result) setState(result);
    });
  }

  return (
    <>
      <Link href="/dashboard" className="marking transition-colors hover:text-chalk">
        ← All events
      </Link>
      <h1 className="display mt-6 text-[2.6rem] text-chalk">New event</h1>

      <form onSubmit={handleSubmit} className="mt-12 flex flex-col gap-12">
        {state.error ? (
          <p className="border-l-2 border-danger py-1 pl-4 text-[14px] text-danger" role="alert">
            {state.error}
          </p>
        ) : null}

        <TextField
          label="Event name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Aarav & Diya's wedding"
          required
          maxLength={80}
          error={state.fields?.name}
        />

        <ChipGroup
          label="What kind of event?"
          columns="grid-cols-2 sm:grid-cols-3"
          options={EVENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          value={type}
          onChange={(value) => setType(value)}
          hint="We use this to ask your guests the right question when they join."
          error={state.fields?.type}
        />

        {relationMode === "sides" ? (
          <div className="grid gap-8 sm:grid-cols-2">
            <TextField
              label={config.nameFields?.a ?? "First name"}
              value={partnerA}
              onChange={(e) => setPartnerA(e.target.value)}
              placeholder="Aarav"
              maxLength={40}
              error={state.fields?.partnerA}
            />
            <TextField
              label={config.nameFields?.b ?? "Second name"}
              value={partnerB}
              onChange={(e) => setPartnerB(e.target.value)}
              placeholder="Diya"
              maxLength={40}
              error={state.fields?.partnerB}
            />
          </div>
        ) : null}

        {relationMode === "honoree" ? (
          <TextField
            label={config.nameFields?.a ?? "Name"}
            value={honoreeName}
            onChange={(e) => setHonoreeName(e.target.value)}
            maxLength={40}
            error={state.fields?.honoreeName}
          />
        ) : null}

        {relationMode !== "none" ? (
          <Toggle
            label="Ask guests how they know you"
            description={
              relationMode === "sides"
                ? "Guests pick a side and can add a word or two — cousin, college friend. Turn this off and we'll only ask for their name."
                : "Guests add a word or two about how they know the guest of honour. Turn this off and we'll only ask for their name."
            }
            checked={askRelation}
            onChange={setAskRelation}
          />
        ) : null}

        <TextField
          label="When does it start?"
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          required
          className="tabular"
          hint="Guests can't join or shoot before this."
          error={state.fields?.startsAt}
        />

        <ChipGroup
          label="Photos unlock"
          columns="grid-cols-3"
          options={REVEAL_OPTIONS.map((r) => ({ value: r.hours, label: r.label }))}
          value={revealDelayHours}
          onChange={setRevealDelayHours}
          hint="Counted from the start time. Guests keep shooting right up until then — that's the moment everything appears at once."
          error={state.fields?.revealDelayHours}
        />

        <ChipGroup
          label="How many people?"
          columns="grid-cols-4 sm:grid-cols-7"
          options={GUEST_COUNT_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
          value={maxGuests}
          onChange={setMaxGuests}
          hint="An upper limit, not a target — pick the next size up if you're unsure."
          error={state.fields?.maxGuests}
        />

        <Slider
          label="Photos each person gets"
          min={MIN_PHOTOS_PER_GUEST}
          max={MAX_PHOTOS_PER_GUEST}
          value={photosPerGuest}
          onChange={setPhotosPerGuest}
          unit="each"
          hint="Fewer shots makes people choosier. Around 15 works well for a long evening."
        />

        <div className="flex flex-col gap-4 border-t border-hair pt-10 sm:flex-row-reverse sm:justify-start">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Creating…" : "Create event"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => history.back()}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
}
