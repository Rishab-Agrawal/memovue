"use client";

import { useActionState } from "react";

import { TextArea, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

import { type ActionState, requestAccessAction } from "./actions";

export function AccessRequestForm() {
  const [state, action] = useActionState<ActionState, FormData>(requestAccessAction, {});

  return (
    <form action={action} className="mt-7 flex flex-col gap-5">
      {state.error ? (
        <p
          className="rounded-md border border-danger/35 bg-danger/10 px-4 py-3 text-[14px] text-danger"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <TextField
        label="What are you hosting?"
        name="eventKind"
        required
        placeholder="My sister's wedding"
        error={state.fields?.eventKind}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Roughly when?"
          name="expectedDate"
          placeholder="Mid December"
          error={state.fields?.expectedDate}
        />
        <TextField
          label="How many people?"
          name="guestEstimate"
          placeholder="About 200"
          error={state.fields?.guestEstimate}
        />
      </div>
      <TextField
        label="WhatsApp number"
        name="phone"
        type="tel"
        placeholder="Optional"
        hint="Only so we can reach you quickly if we need to."
        error={state.fields?.phone}
      />
      <TextArea
        label="Anything else?"
        name="note"
        placeholder="Optional"
        error={state.fields?.note}
      />

      <SubmitButton size="lg" pendingLabel="Sending…" className="self-start px-8">
        Request access
      </SubmitButton>
    </form>
  );
}
