"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

import {
  type AdminState,
  createInviteCodeAction,
  decideAccessAction,
  deleteInviteCodeAction,
} from "./actions";

export function AccessDecision({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function decide(approve: boolean) {
    startTransition(async () => {
      await decideAccessAction(userId, approve);
      router.refresh();
    });
  }

  return (
    <div className="flex shrink-0 gap-2">
      <Button size="sm" disabled={pending} onClick={() => decide(true)}>
        Approve
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => decide(false)}>
        Decline
      </Button>
    </div>
  );
}

export function InviteCodeForm() {
  const [state, action] = useActionState<AdminState, FormData>(createInviteCodeAction, {});

  return (
    <form action={action} className="mt-8 flex flex-col gap-6">
      {state.createdCode ? (
        <p className="border-l-2 border-success py-1 pl-5 text-[14px] text-success">
          Created <strong className="tabular tracking-[0.16em]">{state.createdCode}</strong> — send
          it to the host and they&rsquo;ll skip the queue.
        </p>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <TextField
          label="Who's it for?"
          name="note"
          placeholder="Priya — Dec wedding"
          error={state.fields?.note}
        />
        <TextField
          label="Uses"
          name="maxUses"
          type="number"
          min={1}
          max={500}
          defaultValue={1}
          className="sm:w-24"
          error={state.fields?.maxUses}
        />
        <SubmitButton pendingLabel="Creating…" className="sm:mb-0.5">
          Create code
        </SubmitButton>
      </div>
    </form>
  );
}

export function DeleteInviteCode({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirming) {
          setConfirming(true);
          setTimeout(() => setConfirming(false), 3000);
          return;
        }
        startTransition(async () => {
          await deleteInviteCodeAction(id);
          router.refresh();
        });
      }}
      className="marking shrink-0 transition-colors hover:text-danger disabled:opacity-50"
    >
      {confirming ? "Tap again" : "Revoke"}
    </button>
  );
}
