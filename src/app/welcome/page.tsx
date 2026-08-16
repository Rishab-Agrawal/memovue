import Link from "next/link";

import { Mark } from "@/components/ui/Logo";

import { PillLink } from "@/components/roll/Chrome";
import { Google, Qr } from "@/components/roll/Icons";

/**
 * The reference pairs Apple and Google side by side. With one provider the button goes full
 * width rather than sitting half-empty, and the guest route keeps its own row underneath —
 * it is a different kind of arrival, not a third sign-in option.
 */
export default function Welcome() {
  return (
    <div className="flex min-h-full flex-col px-6 py-10">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <Mark glow className="h-16 w-auto" />
        <h1 className="display text-center text-[34px] text-chalk">Welcome to MemoVue</h1>
      </div>

      <div className="space-y-3">
        <PillLink href="/proto/home?v=empty" variant="light" full>
          <Google className="h-5 w-5" />
          Google
        </PillLink>

        <PillLink href="/proto/join" variant="quiet" full>
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
