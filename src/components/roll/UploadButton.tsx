"use client";

import { useRef, useState, type ReactNode } from "react";

import { useToast } from "@/components/roll/Toast";
import { cn } from "@/lib/cn";
import { type ProcessedPhoto, decode, processCapture } from "@/lib/image";

/**
 * Photos from the phone's library, spent like shots. A file input cannot cap how many are
 * picked, so a pick over the allowance is refused whole rather than trimmed.
 */
export function UploadButton({
  left,
  off,
  onPicked,
  className,
  children,
}: {
  /** Shots this person may still spend. */
  left: number;
  /** Why it cannot be used right now, said when tapped. */
  off?: string;
  /** Each photo once it is ready, in the order picked. */
  onPicked: (photo: ProcessedPhoto) => void;
  className?: string;
  children: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [say, toast] = useToast();

  async function upload(files: File[]) {
    if (files.length > left) {
      say(`You can only upload ${left} ${left === 1 ? "photo" : "photos"}!`);
      return;
    }

    setBusy(true);
    let unreadable = 0;
    // One at a time: each decoded original is tens of megabytes.
    for (const file of files) {
      try {
        const image = await decode(file);
        onPicked(await processCapture(image));
        if ("close" in image) image.close();
      } catch {
        unreadable += 1;
      }
    }
    setBusy(false);

    if (unreadable) {
      say(unreadable === 1 ? "One photo couldn’t be read." : `${unreadable} photos couldn’t be read.`);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        aria-disabled={off ? "true" : undefined}
        onClick={() => (off ? say(off) : input.current?.click())}
        className={cn(className, busy && "opacity-60")}
      >
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          // Cleared, so picking the same photos again still fires.
          event.target.value = "";
          if (files.length) void upload(files);
        }}
      />
      {toast}
    </>
  );
}
