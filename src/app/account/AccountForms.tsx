"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

import { type AccountState, changePasswordAction, deleteAccountAction } from "./actions";

export function ChangePasswordForm() {
  const [state, action] = useActionState<AccountState, FormData>(changePasswordAction, {});

  return (
    <form action={action} className="mt-5 flex flex-col gap-5">
      {state.success ? (
        <p className="rounded-md border border-success/40 bg-success/10 px-4 py-3 text-[14px] text-success">
          {state.success}
        </p>
      ) : null}
      {state.error ? (
        <p className="rounded-md border border-danger/35 bg-danger/10 px-4 py-3 text-[14px] text-danger">
          {state.error}
        </p>
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

      <SubmitButton variant="secondary" pendingLabel="Saving…" className="self-start">
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
      <Button variant="danger" size="sm" className="mt-5" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
    );
  }

  return (
    <form action={action} className="mt-5 flex flex-col gap-4">
      {state.error ? (
        <p className="rounded-md border border-danger/35 bg-danger/10 px-4 py-3 text-[14px] text-danger">
          {state.error}
        </p>
      ) : null}

      <TextField
        label="Confirm with your password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fields?.password}
      />
      <div className="flex flex-wrap gap-3">
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
