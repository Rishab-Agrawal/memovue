import Link from "next/link";
import { redirect } from "next/navigation";

import { Mark } from "@/components/ui/Logo";

import { PillLink } from "@/components/roll/Chrome";
import { Google, Qr } from "@/components/roll/Icons";
import { SAMPLE_ALBUM } from "@/lib/sample-album";
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
 * The front door: create, try the sample, or join — none needing an account up front. Sign-in
 * is asked for at Create; returning hosts use the button in the corner.
 */
export default async function Welcome({ searchParams }: PageProps<"/welcome">) {
  // Signed in already: landing here would look like being signed out.
  if (await getCurrentUser()) redirect("/rolls");

  const params = await searchParams;
  const error = typeof params.error === "string" ? MESSAGES[params.error] : undefined;

  return (
    <div className="flex min-h-dvh flex-col px-6 py-6">
      {/* A plain anchor: a route handler that redirects to Google. */}
      <a
        href="/api/auth/google/start"
        className="ml-auto inline-flex h-10 items-center gap-2 rounded-full border border-hair-bright bg-surface px-4 text-[14px] font-medium whitespace-nowrap text-chalk transition-[color,background-color,scale] duration-150 hover:text-flame active:scale-[0.97]"
      >
        <Google className="h-4 w-4" />
        Sign in
      </a>

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
        <PillLink href="/new/name" variant="flame" full>
          Create a roll
        </PillLink>

        {/* Starts at the invitation, as a real guest would. */}
        <PillLink href={`${SAMPLE_ALBUM.href}/join`} variant="quiet" full>
          Experience a sample roll
        </PillLink>

        <PillLink href="/join" variant="quiet" full>
          <Qr className="h-5 w-5" />
          Invited? Join a roll
        </PillLink>
      </div>

      <p className="mt-6 text-center text-[13px] leading-relaxed text-dust">
        By continuing, you agree to MemoVue&rsquo;s{" "}
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
