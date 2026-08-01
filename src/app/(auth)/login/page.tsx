"use client";

import Link from "next/link";
import { useActionState } from "react";

import { TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

import { type AuthFormState, loginAction } from "../actions";

export default function LoginPage() {
  const [state, action] = useActionState<AuthFormState, FormData>(loginAction, {});

  return (
    <>
      <h1 className="font-display text-[2.4rem] leading-tight text-paper">Welcome back</h1>
      <p className="mt-2 text-[15px] text-paper-dim">Sign in to manage your events.</p>

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
          autoComplete="current-password"
          required
          error={state.fields?.password}
        />

        <SubmitButton size="lg" full pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>

      <p className="mt-7 text-center text-[15px] text-paper-dim">
        No account yet?{" "}
        <Link href="/signup" className="text-ember hover:underline">
          Create one
        </Link>
      </p>
    </>
  );
}
