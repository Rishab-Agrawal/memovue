"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

import { type AuthFormState, signupAction } from "../actions";

export default function SignupPage() {
  const [state, action] = useActionState<AuthFormState, FormData>(signupAction, {});
  // Most people won't have a code, so it stays out of the way until asked for.
  const [showInvite, setShowInvite] = useState(false);

  return (
    <>
      <h1 className="font-display text-[2.4rem] leading-tight text-paper">Create your account</h1>
      <p className="mt-2 text-[15px] text-paper-dim">
        Free while we&rsquo;re in beta. Guests never need an account — this is just for you.
      </p>

      <form action={action} className="mt-8 flex flex-col gap-5">
        {state.error ? (
          <p
            className="rounded-md border border-danger/35 bg-danger/10 px-4 py-3 text-[14px] text-danger"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}

        <TextField
          label="Your name"
          name="name"
          autoComplete="name"
          required
          error={state.fields?.name}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={state.fields?.email}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="At least 8 characters."
          error={state.fields?.password}
        />

        {showInvite || state.fields?.inviteCode ? (
          <TextField
            label="Invite code"
            name="inviteCode"
            autoCapitalize="characters"
            placeholder="ABCD1234"
            hint="Skips the waiting list and lets you create events straight away."
            error={state.fields?.inviteCode}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="self-start text-[14px] text-paper-dim underline underline-offset-4 transition-colors hover:text-paper"
          >
            I have an invite code
          </button>
        )}

        <SubmitButton size="lg" full pendingLabel="Creating account…">
          Create account
        </SubmitButton>
      </form>

      <p className="mt-7 text-center text-[15px] text-paper-dim">
        Already have an account?{" "}
        <Link href="/login" className="text-ember hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
