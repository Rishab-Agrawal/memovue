"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { BackButton, PillLink } from "../components/Chrome";
import { Dialog } from "../components/Dialog";
import { Plate } from "../components/Plate";

export default function JoinFilm() {
  const invalid = useSearchParams().get("v") === "invalid";
  const [link, setLink] = useState(invalid ? "frhbcs" : "");

  return (
    <div className="relative flex min-h-full flex-col">
      {/* The camera feed. A plate rather than a real getUserMedia stream — the prototype
          should never ask for a permission it does nothing with. */}
      <div className="relative flex-1">
        <Plate index={5} className="absolute inset-0" />
        <div className="absolute inset-x-0 top-0 p-4">
          <BackButton href="/proto/welcome" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-[200px] w-[200px] rounded-3xl border-2 border-dashed border-flame/70" />
        </div>
      </div>

      <div className="space-y-4 bg-page px-5 py-6">
        <p className="marking">Or paste invitation link</p>

        <input
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder="Paste link"
          aria-label="Invitation link"
          className="h-14 w-full rounded-2xl bg-surface px-4 text-chalk placeholder:text-dust focus:outline-none focus-visible:ring-1 focus-visible:ring-flame"
        />

        <PillLink
          href={link.trim() ? "/proto/guest" : "/proto/join?v=invalid"}
          variant="light"
          full
        >
          Join →
        </PillLink>
      </div>

      <Dialog
        open={invalid}
        title="Invalid link"
        actions={
          <PillLink href="/proto/join" variant="quiet" full>
            OK
          </PillLink>
        }
      >
        Please scan a QR code or paste a valid invitation link.
      </Dialog>
    </div>
  );
}
