"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { deleteEventAction, revealNowAction } from "../../actions";

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard is blocked outside secure contexts; the link is on screen either way.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="secondary" onClick={copy}>
      {copied ? "Copied" : "Copy join link"}
    </Button>
  );
}

export function RevealNowButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        Reveal photos now
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-ember/40 bg-ember/8 p-4">
      <p className="text-[14px] leading-relaxed text-paper">
        This opens the album for everyone immediately and <strong>stops guests taking any
        more photos</strong>. It can&rsquo;t be undone.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await revealNowAction(eventId);
              router.refresh();
            })
          }
        >
          {pending ? "Revealing…" : "Yes, reveal now"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function DeleteEventButton({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
        Delete this event
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-danger/40 bg-danger/8 p-4">
      <p className="text-[14px] leading-relaxed text-paper">
        This permanently deletes the event and <strong>every photo in it</strong>, for every
        guest. There is no way to get them back.
      </p>
      <label className="text-[13px] text-paper-dim">
        Type <span className="text-paper">{eventName}</span> to confirm
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-md border border-line bg-ink-inset px-3 text-paper focus:border-danger focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          size="sm"
          disabled={pending || typed !== eventName}
          onClick={() => startTransition(async () => void (await deleteEventAction(eventId)))}
        >
          {pending ? "Deleting…" : "Delete permanently"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setConfirming(false);
            setTyped("");
          }}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
