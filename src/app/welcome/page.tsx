import Link from "next/link";
import { redirect } from "next/navigation";

import { Mark } from "@/components/ui/Logo";

import { PillLink } from "@/components/roll/Chrome";
import { Google, Qr } from "@/components/roll/Icons";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Welcome" };

const MESSAGES: Record<string, string> = {
  declined: "Sign-in was cancelled.",
  no_code: "Google didn't complete the sign-in. Please try again.",
  bad_state: "That sign-in link expired. Please try again.",
  verification_failed: "We couldn't verify that Google account. Please try again.",
  too_many: "Too many sign-in attempts from this network. Try again in a few minutes.",
};

/**
 * The reference pairs Apple and Google side by side. With one provider the button goes full
 * width rather than sitting half-empty, and the guest route keeps its own row underneath —
 * it is a different kind of arrival, not a third sign-in option.
 */
export default async function Welcome({ searchParams }: PageProps<"/welcome">) {
  /*
    Someone already signed in has no business on the sign-in screen.

    Reaching it while signed in reads as having been signed out — which is exactly what
    happened to anyone who tapped Join from their home screen and then pressed back, since
    this page sat behind that button and offers nothing but "Continue with Google".
  */
  if (await getCurrentUser()) redirect("/rolls");

  const params = await searchParams;
  const error = typeof params.error === "string" ? MESSAGES[params.error] : undefined;

  return (
    <div className="flex min-h-dvh flex-col px-6 py-10">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <Mark glow className="h-16 w-auto" />
        <h1 className="display text-center text-[34px] text-chalk">Welcome to MemoVue</h1>
      </div>

      {error ? (
        <p role="alert" className="mb-4 text-center text-[14px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        {/*
          A plain anchor, not a Link: this hands off to a route handler that redirects to
          Google, and a client-side navigation has nowhere to go.
        */}
        <a
          href="/api/auth/google/start"
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-chalk px-6 text-[15px] font-medium whitespace-nowrap text-void transition-colors hover:bg-white"
        >
          <Google className="h-5 w-5" />
          Continue with Google
        </a>

        <PillLink href="/join" variant="quiet" full>
          <Qr className="h-5 w-5" />
          Invited? Join a roll
        </PillLink>
      </div>

      <p className="mt-6 text-center text-[13px] leading-relaxed text-dust">
        By signing up, you agree to MemoVue&rsquo;s{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-ash">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-ash">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
