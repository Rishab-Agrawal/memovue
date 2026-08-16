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
      <h1 className="display text-[2.6rem] text-chalk">
        Set up your
        <br />
        first event
      </h1>
      <p className="mt-5 text-[15px] leading-relaxed text-ash">
        Free while we&rsquo;re in beta. Your guests never need an account — this is just for you.
      </p>

      <form action={action} className="mt-10 flex flex-col gap-7">
        {state.error ? (
          <p className="border-l-2 border-danger py-1 pl-4 text-[14px] text-danger" role="alert">
            {state.error}
          </p>
        ) : null}

        {/* Every field carries a placeholder. Without one, an underline input is a label,
            a gap, and a rule — three times over, with nothing saying where to type. */}
        <TextField
          label="Your name"
          name="name"
          autoComplete="name"
          placeholder="Riya Sharma"
          required
          error={state.fields?.name}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          error={state.fields?.email}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
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
            className="tabular tracking-[0.2em]"
            hint="Skips the waiting list and lets you create events straight away."
            error={state.fields?.inviteCode}
          />
        ) : (
          /* Set as sentence case, not as a `marking` label. In tracked uppercase over a
             hairline it was pixel-for-pixel the same treatment as YOUR NAME and EMAIL
             directly above it, so the one control on the form read as a fourth field. */
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="flex h-11 items-center self-start text-[14px] text-ash transition-colors hover:text-flame"
          >
            <span className="border-b border-hair-bright pb-0.5 transition-colors hover:border-flame">
              I have an invite code
            </span>
          </button>
        )}

        <SubmitButton size="lg" full pendingLabel="Creating…" className="mt-2">
          Create account
        </SubmitButton>
      </form>

      <p className="mt-10 text-[14px] text-ash">
        Already have an account?{" "}
        <Link
          href="/login"
          className="border-b border-hair-bright pb-0.5 text-chalk transition-colors hover:border-flame hover:text-flame"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
