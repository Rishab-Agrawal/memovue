"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Mark } from "@/components/ui/Logo";
import { normalizeCode } from "@/lib/codes";

/**
 * Fallback for when the QR won't scan — a scuffed printout, a cracked screen, a camera
 * that refuses to focus. The code is printed under every QR for exactly this.
 */
export default function JoinByCodePage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const cleaned = normalizeCode(code);

  return (
    <div className="bloom flex min-h-dvh flex-col px-6 pb-16">
      <header className="py-6">
        <Mark className="h-8 w-auto" glow />
      </header>
      <main className="flex flex-1 flex-col justify-center">
        <form
          className="animate-rise mx-auto w-full max-w-[24rem]"
          onSubmit={(event) => {
            event.preventDefault();
            if (cleaned.length >= 4) router.push(`/join/${cleaned}`);
          }}
        >
          <p className="marking text-flame">Join an event</p>
          <h1 className="display mt-4 text-[clamp(2.4rem,11vw,3.2rem)] text-chalk">
            Enter your code
          </h1>
          <p className="mt-6 text-[16px] leading-relaxed text-ash">
            It&rsquo;s printed underneath the QR code your host shared.
          </p>

          <div className="mt-10">
            <TextField
              label="Join code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoComplete="off"
              autoFocus
              placeholder="Z7G9UJ"
              maxLength={9}
              className="tabular h-14 text-[1.6rem] tracking-[0.3em]"
            />
          </div>

          <Button type="submit" size="lg" full className="mt-8" disabled={cleaned.length < 4}>
            Continue
          </Button>
        </form>
      </main>
    </div>
  );
}
