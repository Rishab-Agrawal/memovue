"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Camera, Download, Lock, Qr } from "@/components/roll/Icons";
import { cn } from "@/lib/cn";
import { ZIP_DOWNLOAD_SPENT } from "@/lib/constants";

/**
 * The pieces below the cover, shared by the host's roll home and the guest's album.
 */

/** Every control in the row is this shape and this width, whatever it does. */
const tile =
  "flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-[14px] font-medium";

export function RollControls({
  ended,
  cameraHref,
  inviteHref,
  saveHref,
  downloadsLeft,
  onCamera,
  cameraOff,
}: {
  /**
   * Whether the shutter has closed. It is what splits this row: a roll still running wants a
   * camera and a way to invite people to it; one that is over wants the album handed round or
   * taken away.
   *
   * It used to split on whether the photographs were legible, which meant a roll set to
   * reveal *during* the event lost its camera and its invite button the moment it opened —
   * mid-party, with guests still arriving and film left in every pocket.
   */
  ended: boolean;
  /** Ignored when `onCamera` is given, which is how the guest app keeps its stream alive. */
  cameraHref?: string;
  /** Omitted by a guest, who has no invite sheet to open. */
  inviteHref?: string;
  /** Where "Save" goes. Omitted by anyone who cannot download the album. */
  saveHref?: string;
  /** ZIP downloads this roll has left of its lifetime ten. Ignored without `saveHref`. */
  downloadsLeft?: number;
  /** When given, the camera closes a sheet instead of navigating — the guest app keeps its
      viewfinder alive underneath rather than tearing the stream down and back up. */
  onCamera?: () => void;
  /**
   * Why the camera cannot be used, when it cannot — a spent quota, or a roll whose window is
   * not open. The camera stays put and says this when tapped, rather than disappearing.
   */
  cameraOff?: string;
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
  if (ended && !saveHref) return null;

  return (
    <>
      {/*
        Equal width, and every control named rather than left to a glyph.

        This was one wide white pill with a camera on it and two unlabelled squares beside it —
        the reference's exact arrangement, and a row where two of the three controls could only
        be guessed at. Equal width says they are peers; the words say what they do; and the one
        that matters is the one filled in the accent colour, not the one three times wider.

        A finished roll offers only Save. It used to offer a Send beside it, which opened the
        invite sheet — the join link. Handing that round is not the same as handing a photograph
        round: a photograph is a public object on a CDN and costs the same whether one person or
        a million open it, while the album is a dynamic page that polls every twenty seconds per
        open tab and hands each new arrival a participant slot out of the roll's cap. So the
        album travels as the ZIP, and single frames travel as their own cached links.
      */}
      <div className="flex gap-2">
        {ended ? (
          <>
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
              Out of film, or the roll is not shooting yet. Removing the control would leave
              the row a different shape every time somebody spends their last shot, and a live
              camera that leads somewhere that refuses the photo is worse still — so it stays
              where it was and answers when tapped.
            */}
            {cameraOff ? (
              <button
                type="button"
                aria-disabled="true"
                aria-label="Take a photo"
                onClick={() => setNotice(cameraOff)}
                className={cn(tile, "bg-surface text-dust/60")}
              >
                <Camera className="h-5 w-5" />
                Camera
              </button>
            ) : onCamera ? (
              <button
                type="button"
                onClick={onCamera}
                aria-label="Take a photo"
                className={cn(tile, "bg-flame text-void")}
              >
                <Camera className="h-5 w-5" />
                Camera
              </button>
            ) : cameraHref ? (
              <Link
                href={cameraHref}
                aria-label="Take a photo"
                className={cn(tile, "bg-flame text-void")}
              >
                <Camera className="h-5 w-5" />
                Camera
              </Link>
            ) : null}

            {inviteHref ? (
              <Link
                href={inviteHref}
                aria-label="Invite guests"
                className={cn(tile, "bg-surface text-chalk transition-colors hover:text-flame")}
              >
                <Qr className="h-5 w-5" />
                Invite
              </Link>
            ) : null}
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
  const className = cn(tile, "bg-surface text-chalk transition-colors hover:text-flame");

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
    <div className="flex items-center justify-center gap-2.5 border-y border-hair py-3.5 text-[13px] text-dust">
      <Lock className="h-4 w-4" />
      Only the host can see everyone&rsquo;s photos
    </div>
  );
}
