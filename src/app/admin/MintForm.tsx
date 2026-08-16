"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Pill } from "@/components/roll/Chrome";

import { mintAction } from "./actions";

export function MintForm() {
  const router = useRouter();
  const [count, setCount] = useState(5);
  const [note, setNote] = useState("");
  const [minted, setMinted] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();

  const mint = () => {
    startTransition(async () => {
      const result = await mintAction({ count, note: note.trim() || undefined });
      if (result.ok) {
        setMinted(result.codes);
        setNote("");
        router.refresh();
      }
    });
  };

  return (
    <div className="mt-8 rounded-2xl bg-surface p-5">
      <div className="flex gap-3">
        <label className="flex-1">
          <span className="marking">Note</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="who these are for"
            className="mt-2 h-12 w-full rounded-2xl bg-void px-4 text-[15px] text-chalk placeholder:text-dust focus:outline-none focus-visible:ring-1 focus-visible:ring-flame"
          />
        </label>
        <label className="w-24">
          <span className="marking">How many</span>
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            className="tabular mt-2 h-12 w-full rounded-2xl bg-void px-4 text-[15px] text-chalk focus:outline-none focus-visible:ring-1 focus-visible:ring-flame"
          />
        </label>
      </div>

      <Pill variant="flame" full className="mt-4" disabled={pending} onClick={mint}>
        {pending ? "Minting…" : "Mint codes"}
      </Pill>

      {minted ? (
        <div className="mt-5 border-t border-hair pt-4">
          <p className="marking">Just minted — copy them now</p>
          <p className="tabular mt-2 text-[16px] leading-relaxed tracking-[0.1em] break-all text-flame">
            {minted.join("  ")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
