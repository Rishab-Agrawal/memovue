"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Camera, Download, Lock, Qr, Send } from "@/components/roll/Icons";
import { ZIP_DOWNLOAD_SPENT } from "@/lib/constants";

/**
 * The pieces below the cover, shared by the host's roll home and the guest's album.
 */

export function RollControls({
  revealed,
  cameraHref,
  inviteHref,
  sendHref,
  saveHref,
  downloadsLeft,
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
  /** ZIP downloads this roll has left of its lifetime ten. Ignored without `saveHref`. */
  downloadsLeft?: number;
  /** When given, the camera closes a sheet instead of navigating — the guest app keeps its
      viewfinder alive underneath rather than tearing the stream down and back up. */
  onCamera?: () => void;
  /** No shots left for whoever is looking. The camera stays put, but says why it is dead. */
  outOfFilm?: boolean;
}) {
  /*
    One line of transient text for the whole row.

    Every control here can be tapped and produce no visible result — a spent camera, a
    download that is not available yet, a ZIP that takes a minute to build before the browser
    shows anything. A control that silently declines is indistinguishable from a broken one,
    so each of them answers.
  */
  const [notice, setNotice] = useState<string | null>(null);

  // Long enough to read what it says. The refusal past the download ceiling carries an email
  // address, and a fixed 2.6 seconds took it away before anyone could write it down.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), Math.max(2600, notice.length * 70));
    return () => clearTimeout(timer);
  }, [notice]);

  /*
    Spent downloads, counted here as well as on the server.

    The server holds the real ceiling — this is a number rendered once, and nothing reloads
    the page between two taps of Save. Without the local count the tenth and eleventh clicks
    in one sitting look identical from here, and the eleventh navigates the browser onto a
    plain-text refusal instead of showing it as a message on the album.
  */
  const [spent, setSpent] = useState(0);
  const left = downloadsLeft === undefined ? Infinity : downloadsLeft - spent;

  // A guest has neither, and two dead buttons are worse than none.
  if (revealed && !sendHref && !saveHref) return null;

  return (
    <>
      <div className="flex gap-3">
        {revealed ? (
          <>
            {sendHref ? (
              <Control href={sendHref} label="Send" icon={<Send className="h-5 w-5" />} />
            ) : null}
            {saveHref ? (
              <Control
                href={saveHref}
                label="Save"
                icon={<Download className="h-5 w-5" />}
                onClick={(event) => {
                  if (left <= 0) {
                    event.preventDefault();
                    setNotice(ZIP_DOWNLOAD_SPENT);
                    return;
                  }
                  setSpent((count) => count + 1);
                  setNotice("Building your album — the download starts on its own. Big rolls take a minute.");
                }}
              />
            ) : null}
          </>
        ) : (
          <>
            {/*
              Out of film. Removing the control would leave the row a different shape every
              time somebody spends their last shot, and a live camera that refuses to take a
              photo is worse still — so it stays where it was and answers when tapped.
            */}
            {outOfFilm ? (
              <button
                type="button"
                aria-disabled="true"
                aria-label="Take a photo"
                onClick={() => setNotice("That’s all your shots for this roll.")}
                className="flex h-14 flex-1 items-center justify-center rounded-full bg-surface text-dust/60"
              >
                <Camera className="h-6 w-6" />
              </button>
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

            {/* Nothing to download until the reveal. It was a bare span, so the one dead
                control that said nothing sat right beside the one that did. */}
            <button
              type="button"
              aria-disabled="true"
              aria-label="Download album"
              onClick={() => setNotice("The album can be saved once the roll is revealed.")}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-dust/50"
            >
              <Download className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {notice ? (
        <p
          role="status"
          className="animate-fade pointer-events-none fixed top-1/2 left-1/2 z-50 max-w-[16rem] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface/95 px-5 py-3.5 text-center text-[14px] leading-snug text-chalk shadow-[0_8px_40px_-8px_rgba(0,0,0,0.9)] backdrop-blur-sm"
        >
          {notice}
        </p>
      ) : null}
    </>
  );
}

function Control({
  href,
  label,
  icon,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Takes the event so a control can refuse the navigation it would otherwise start. */
  onClick?: (event: React.MouseEvent) => void;
}) {
  const className =
    "flex h-14 flex-1 items-center justify-center gap-2.5 rounded-2xl bg-surface text-[15px] text-chalk transition-colors hover:text-flame";

  // An API route serves a file, not a page. A client-side navigation would try to render the
  // ZIP as one, so the download leaves through a plain anchor.
  if (href.startsWith("/api/")) {
    return (
      <a href={href} onClick={onClick} className={className}>
        {icon}
        {label}
      </a>
    );
  }

  return (
    <Link href={href} onClick={onClick} className={className}>
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
