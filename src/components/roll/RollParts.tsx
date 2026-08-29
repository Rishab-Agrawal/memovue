"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Camera, Download, Lock, Qr, Send } from "@/components/roll/Icons";

/**
 * The pieces below the cover, shared by the host's roll home and the guest's album.
 */

export function RollControls({
  revealed,
  cameraHref,
  inviteHref,
  sendHref,
  saveHref,
  onCamera,
  outOfFilm,
}: {
  revealed: boolean;
  /** Ignored when `onCamera` is given, which is how the guest app keeps its stream alive. */
  cameraHref?: string;
  /** Omitted by a guest, who has no invite sheet to open. */
  inviteHref?: string;
  /*
    Both were hardcoded to "#", so on an opened roll the only two controls on the screen did
    nothing at all. They are the host's: sharing the album is the invite sheet it already has,
    and saving it is the ZIP route that already exists.
  */
  /** Where "Send" goes. Omitted by anyone with nothing to share. */
  sendHref?: string;
  /** Where "Save" goes. Omitted by anyone who cannot download the album. */
  saveHref?: string;
  /** When given, the camera closes a sheet instead of navigating — the guest app keeps its
      viewfinder alive underneath rather than tearing the stream down and back up. */
  onCamera?: () => void;
  /** No shots left for whoever is looking. The camera stays put, but says why it is dead. */
  outOfFilm?: boolean;
}) {
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(false), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  if (revealed) {
    // A guest has neither, and two dead buttons are worse than none.
    if (!sendHref && !saveHref) return null;

    return (
      <div className="flex gap-3">
        {sendHref ? (
          <Control href={sendHref} label="Send" icon={<Send className="h-5 w-5" />} wide />
        ) : null}
        {saveHref ? (
          <Control href={saveHref} label="Save" icon={<Download className="h-5 w-5" />} wide />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      {/*
        Out of film. Removing the control would leave the row a different shape every time
        somebody spends their last shot, and a live camera that refuses to take a photo is
        worse still — so it stays where it was and answers when tapped.
      */}
      {outOfFilm ? (
        <>
          <button
            type="button"
            aria-disabled="true"
            aria-label="Take a photo"
            onClick={() => setNotice(true)}
            className="flex h-14 flex-1 items-center justify-center rounded-full bg-surface text-dust/60"
          >
            <Camera className="h-6 w-6" />
          </button>
          {notice ? (
            <p
              role="status"
              className="animate-fade pointer-events-none fixed top-1/2 left-1/2 z-50 max-w-[16rem] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface/95 px-5 py-3.5 text-center text-[14px] leading-snug text-chalk shadow-[0_8px_40px_-8px_rgba(0,0,0,0.9)] backdrop-blur-sm"
            >
              That&rsquo;s all your shots for this roll.
            </p>
          ) : null}
        </>
      ) : onCamera ? (
        <button
          type="button"
          onClick={onCamera}
          aria-label="Take a photo"
          className="flex h-14 flex-1 items-center justify-center rounded-full bg-chalk text-void transition-colors hover:bg-white"
        >
          <Camera className="h-6 w-6" />
        </button>
      ) : cameraHref ? (
        <Link
          href={cameraHref}
          aria-label="Take a photo"
          className="flex h-14 flex-1 items-center justify-center rounded-full bg-chalk text-void transition-colors hover:bg-white"
        >
          <Camera className="h-6 w-6" />
        </Link>
      ) : null}

      {inviteHref ? (
        <Link
          href={inviteHref}
          aria-label="Invite guests"
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-chalk transition-colors hover:text-flame"
        >
          <Qr className="h-5 w-5" />
        </Link>
      ) : null}

      {/* Nothing to download until the reveal, and saying so is better than letting the tap
          fail. */}
      <span
        aria-label="Download album"
        aria-disabled="true"
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-dust/50"
      >
        <Download className="h-5 w-5" />
      </span>
    </div>
  );
}

function Control({
  href,
  label,
  icon,
  wide,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  wide?: boolean;
}) {
  const className = `flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-surface text-[15px] text-chalk transition-colors hover:text-flame ${wide ? "flex-1" : ""}`;

  // An API route serves a file, not a page. A client-side navigation would try to render the
  // ZIP as one, so the download leaves through a plain anchor.
  if (href.startsWith("/api/")) {
    return (
      <a href={href} className={className}>
        {icon}
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {icon}
      {label}
    </Link>
  );
}

export function VisibilityNotice() {
  return (
    <div className="flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-surface text-[14px] text-dust">
      <Lock className="h-4 w-4" />
      Only the host can see everyone&rsquo;s photos
    </div>
  );
}
