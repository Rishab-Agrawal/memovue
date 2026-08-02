"use client";

import { useActionState } from "react";

import { TextArea, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

import { type ActionState, requestAccessAction } from "./actions";

export function AccessRequestForm() {
  const [state, action] = useActionState<ActionState, FormData>(requestAccessAction, {});

  return (
    <form action={action} className="mt-12 flex flex-col gap-8 border-t border-hair pt-10">
      {state.error ? (
        <p className="border-l-2 border-danger py-1 pl-4 text-[14px] text-danger" role="alert">
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
      <div className="grid gap-8 sm:grid-cols-2">
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

      <SubmitButton size="lg" pendingLabel="Sending…" className="mt-2 self-start">
        Request access
      </SubmitButton>
    </form>
  );
}
