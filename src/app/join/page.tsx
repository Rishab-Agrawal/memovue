"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BackButton, Pill } from "@/components/roll/Chrome";
import { Qr } from "@/components/roll/Icons";
import { normalizeCode } from "@/lib/codes";

export default function JoinARoll() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  /**
   * Accepts a whole invitation link or just the code, because people paste whichever they
   * happen to have. A pasted URL's last path segment is the code.
   */
  const go = () => {
    const raw = input.trim();
    const candidate = raw.includes("/") ? (raw.split(/[/?#]/).filter(Boolean).pop() ?? "") : raw;
    const code = normalizeCode(candidate);

    if (code.length !== 6) {
      setError("That doesn't look like an invitation. Check the link and try again.");
      return;
    }
    router.push(`/join/${code}`);
  };

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-4 pb-8">
      <BackButton href="/welcome" />

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-surface text-flame">
          <Qr className="h-9 w-9" />
        </span>
        <div>
          <h1 className="display text-[28px] text-chalk">Point your camera at the QR</h1>
          <p className="mx-auto mt-3 max-w-[18rem] text-[15px] leading-relaxed text-ash">
            Your phone&rsquo;s own camera app will open the roll. If someone sent you a link
            instead, paste it below.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <p className="marking">Or paste invitation link</p>

        <input
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => event.key === "Enter" && go()}
          placeholder="Paste link or code"
          aria-label="Invitation link"
          className="h-14 w-full rounded-2xl bg-surface px-4 text-chalk placeholder:text-dust focus:outline-none focus-visible:ring-1 focus-visible:ring-flame"
        />

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}

        <Pill variant="light" full disabled={!input.trim()} onClick={go}>
          Join →
        </Pill>
      </div>
    </div>
  );
}
