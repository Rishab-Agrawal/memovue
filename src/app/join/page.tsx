"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Logo } from "@/components/ui/Logo";
import { normalizeCode } from "@/lib/codes";

/**
 * Fallback for when the QR won't scan — a scuffed printout, a cracked screen, a phone
 * camera that refuses to focus. The code is printed under every QR for exactly this.
 */
export default function JoinByCodePage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const cleaned = normalizeCode(code);

  return (
    <div className="safelight flex min-h-dvh flex-col px-5 pb-12">
      <header className="py-5">
        <Logo />
      </header>
      <main className="flex flex-1 flex-col justify-center">
        <form
          className="mx-auto w-full max-w-[26rem] animate-rise"
          onSubmit={(event) => {
            event.preventDefault();
            if (cleaned.length >= 4) router.push(`/join/${cleaned}`);
          }}
        >
          <h1 className="font-display text-[clamp(2.2rem,9vw,3rem)] leading-[1.05] text-paper">
            Enter your code
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-paper-dim">
            It&rsquo;s printed underneath the QR code your host shared.
          </p>

          <div className="mt-8">
            <TextField
              label="Join code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoComplete="off"
              autoFocus
              placeholder="Z7G9UJ"
              maxLength={9}
              className="text-center font-display text-[1.6rem] tracking-[0.3em]"
            />
          </div>

          <Button type="submit" size="lg" full className="mt-6" disabled={cleaned.length < 4}>
            Continue
          </Button>
        </form>
      </main>
    </div>
  );
}
