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
    <Button variant="secondary" size="sm" onClick={copy}>
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
    <div className="max-w-md border-l-2 border-flame py-1 pl-5">
      <p className="text-[14px] leading-relaxed text-chalk">
        This opens the album for everyone immediately and{" "}
        <strong className="font-medium">stops guests taking any more photos</strong>. It
        can&rsquo;t be undone.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
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
    <div className="max-w-md border-l-2 border-danger py-1 pl-5">
      <p className="text-[14px] leading-relaxed text-chalk">
        This permanently deletes the event and{" "}
        <strong className="font-medium">every photo in it</strong>, for every guest. There is no
        way to get them back.
      </p>
      <label className="marking mt-5 block">
        Type “{eventName}” to confirm
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="mt-2 h-11 w-full border-0 border-b border-hair-bright bg-transparent px-0 text-[16px] text-chalk normal-case tracking-normal outline-none focus:border-danger"
        />
      </label>
      <div className="mt-5 flex flex-wrap gap-3">
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
