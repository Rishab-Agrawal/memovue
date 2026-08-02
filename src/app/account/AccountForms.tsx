"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

import { type AccountState, changePasswordAction, deleteAccountAction } from "./actions";

export function ChangePasswordForm() {
  const [state, action] = useActionState<AccountState, FormData>(changePasswordAction, {});

  return (
    <form action={action} className="mt-8 flex flex-col gap-7">
      {state.success ? (
        <p className="border-l-2 border-flame py-1 pl-5 text-[14px] text-flame">
          {state.success}
        </p>
      ) : null}
      {state.error ? (
        <p className="border-l-2 border-danger py-1 pl-5 text-[14px] text-danger">{state.error}</p>
      ) : null}

      <TextField
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        error={state.fields?.currentPassword}
      />
      <TextField
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="At least 8 characters."
        error={state.fields?.newPassword}
      />

      <SubmitButton variant="secondary" pendingLabel="Saving…" className="mt-2 self-start">
        Change password
      </SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState<AccountState, FormData>(deleteAccountAction, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="danger" size="sm" className="mt-7" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
    );
  }

  return (
    <form action={action} className="mt-8 flex flex-col gap-6 border-l-2 border-danger pl-5">
      {state.error ? (
        <p className="text-[14px] text-danger">{state.error}</p>
      ) : null}

      <TextField
        label="Confirm with your password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fields?.password}
      />
      <div className="flex flex-wrap gap-4">
        <SubmitButton variant="danger" size="sm" pendingLabel="Deleting…">
          Permanently delete everything
        </SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
