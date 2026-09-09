"use client";

import { useState } from "react";

import { Pill } from "@/components/roll/Chrome";
import { Link as LinkIcon, Send } from "@/components/roll/Icons";
import { shareOrCopy } from "@/lib/share";

/**
 * Hands the join link to somebody else.
 *
 * It replaces an "Open link" button, which navigated the host to their own guest screen — the
 * one screen on this sheet that is not for them, and not the thing anybody taps a control
 * under "Invite guests" wanting to do.
 *
 * `navigator.share` is the platform's own answer and on a phone it opens the group chat the
 * invitation was always going to be sent through. Where there is no share sheet — a desktop
 * browser, mostly — the link goes to the clipboard instead and the button says so, because a
 * control that silently did something is indistinguishable from one that did nothing.
 *
 * Only the URL goes across. A title or text alongside it comes back out of the share sheet's
 * own copy option glued in front of the link, and what anybody wants to paste is the link.
 */
export function ShareLink({ url }: { url: string }) {
  const [done, setDone] = useState<"copied" | null>(null);

  async function share() {
    const how = await shareOrCopy({ url });
    if (how !== "copied") return;
    setDone("copied");
    setTimeout(() => setDone(null), 2000);
  }

  return (
    <Pill variant="quiet" full className="px-3 text-[14px]" onClick={share}>
      {done ? (
        <>
          <LinkIcon className="h-4 w-4" />
          Copied
        </>
      ) : (
        <>
          <Send className="h-4 w-4" />
          Share link
        </>
      )}
    </Pill>
  );
}
