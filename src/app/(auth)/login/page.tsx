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
      <h1 className="display text-[2.6rem] text-chalk">Welcome back</h1>

      <form action={action} className="mt-10 flex flex-col gap-7">
        {/* A rule, not a rounded alert box. */}
        {state.error ? (
          <p className="border-l-2 border-danger py-1 pl-4 text-[14px] text-danger" role="alert">
            {state.error}
          </p>
        ) : null}

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
          autoComplete="current-password"
          placeholder="••••••••"
          required
          error={state.fields?.password}
        />

        <SubmitButton size="lg" full pendingLabel="Signing in…" className="mt-2">
          Sign in
        </SubmitButton>
      </form>

      <p className="mt-10 text-[14px] text-ash">
        No account yet?{" "}
        <Link
          href="/signup"
          className="border-b border-hair-bright pb-0.5 text-chalk transition-colors hover:border-flame hover:text-flame"
        >
          Create one
        </Link>
      </p>
    </>
  );
}
