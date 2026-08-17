"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { BackButton, Pill } from "@/components/roll/Chrome";
import { Qr } from "@/components/roll/Icons";
import { QrScanner, type ScannerState } from "@/components/roll/QrScanner";
import { extractJoinCode } from "@/lib/codes";

export default function JoinARoll() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scanner, setScanner] = useState<ScannerState>("starting");
  const [found, setFound] = useState(false);

  const go = (raw: string) => {
    const code = extractJoinCode(raw);
    if (!code) {
      setError("That doesn't look like an invitation. Check the link and try again.");
      return false;
    }
    router.push(`/join/${code}`);
    return true;
  };

  /**
   * A scanned QR is a string from a sticker, not a destination. It goes through the same
   * extraction the paste field uses and we navigate to our own route with the code we got —
   * the browser is never sent to an address that was printed by someone else.
   */
  const handleScan = useCallback(
    (value: string) => {
      const code = extractJoinCode(value);
      if (!code) {
        setError("That QR code isn't a MemoVue invitation.");
        return;
      }
      // Freeze the loop so a code still in frame can't fire a second navigation.
      setFound(true);
      setError(null);
      router.push(`/join/${code}`);
    },
    [router],
  );

  const scanning = scanner === "live" || scanner === "starting";

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-4 pb-8">
      <BackButton href="/welcome" />

      <div className="flex flex-1 flex-col justify-center gap-6 py-6">
        {scanning ? (
          <>
            <QrScanner
              onResult={handleScan}
              onStateChange={setScanner}
              paused={found}
              className="mx-auto max-w-[320px]"
            />
            <p className="text-center text-[15px] leading-relaxed text-ash">
              {found ? "Opening your roll…" : "Point your camera at the invitation QR code."}
            </p>
          </>
        ) : (
          /* No camera, or permission refused. The phone's own camera app still opens these
             links, so say so rather than leaving a dead viewport on the screen. */
          <div className="flex flex-col items-center gap-6 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-surface text-flame">
              <Qr className="h-9 w-9" />
            </span>
            <div>
              <h1 className="display text-[28px] text-chalk">Point your camera at the QR</h1>
              <p className="mx-auto mt-3 max-w-[18rem] text-[15px] leading-relaxed text-ash">
                {scanner === "denied"
                  ? "MemoVue can't open your camera, but your phone's own camera app will open the roll. Or paste the link below."
                  : "Your phone's own camera app will open the roll. If someone sent you a link instead, paste it below."}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <p className="marking">Or paste invitation link</p>

        <input
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => event.key === "Enter" && go(input)}
          placeholder="Paste link or code"
          aria-label="Invitation link"
          className="h-14 w-full rounded-2xl bg-surface px-4 text-chalk placeholder:text-dust focus:outline-none focus-visible:ring-1 focus-visible:ring-flame"
        />

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}

        <Pill variant="light" full disabled={!input.trim()} onClick={() => go(input)}>
          Join →
        </Pill>
      </div>
    </div>
  );
}
