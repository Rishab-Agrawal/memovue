"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Camera, Download, Lock, Photo, Qr } from "@/components/roll/Icons";
import { cn } from "@/lib/cn";
import { SHOTS_HELD, SHOTS_SPENT, ZIP_DOWNLOAD_SPENT } from "@/lib/constants";
import { subscribeQueue } from "@/lib/upload-queue";

/** The pieces below the cover, shared by the host's roll home and the guest's album. */

/** Every control in the row is this shape and this width, whatever it does. */
const tile =
  "flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-[14px] font-medium " +
  "transition-[color,background-color,scale] duration-150 active:scale-[0.97]";

export function RollControls({
  ended,
  code,
  shotsLeft,
  cameraHref,
  inviteHref,
  poolHref,
  poolLeft = 0,
  refill = 0,
  saveHref,
  downloadsLeft,
  onCamera,
  cameraOff,
}: {
  /** Whether the shutter has closed: a running roll offers camera and invite, a finished one Save. */
  ended: boolean;
  /** This roll's join code, so the queue's counts can be told apart from another roll's. */
  code?: string;
  /** Film left as the server counted it; read together with the upload queue below. */
  shotsLeft?: number;
  /** Ignored when `onCamera` is given. */
  cameraHref?: string;
  inviteHref?: string;
  poolHref?: string;
  /** Unclaimed film in the roll. Only read to tell the two refusals below apart. */
  poolLeft?: number;
  /** What this guest could draw once their own film is gone. The camera stays live while > 0. */
  refill?: number;
  /** Where "Save" goes. Omitted by anyone who cannot download the album. */
  saveHref?: string;
  /** ZIP downloads this roll has left of its lifetime ten. Ignored without `saveHref`. */
  downloadsLeft?: number;
  /** When given, the camera calls this instead of navigating. */
  onCamera?: () => void;
  /** Why the camera cannot be used, when the roll's window is not open. Said when tapped. */
  cameraOff?: string;
}) {
  // Shots this phone has spent that the server has not counted yet.
  const [unreserved, setUnreserved] = useState(0);
  useEffect(
    () =>
      subscribeQueue((queue) => setUnreserved(queue.code === code ? queue.unreserved : 0)),
    [code],
  );

  // Refuses only with no film of their own and no refill allowed; which one decides the sentence.
  const filmSpent = shotsLeft !== undefined && shotsLeft - unreserved <= 0;
  const off =
    cameraOff ??
    (filmSpent && refill <= 0 ? (poolLeft > 0 ? SHOTS_HELD : SHOTS_SPENT) : undefined);

  // One line of transient text for the row, so no control declines silently.
  const [notice, setNotice] = useState<string | null>(null);

  // Long enough to read, including the refusal that carries an email address.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), Math.max(2600, notice.length * 70));
    return () => clearTimeout(timer);
  }, [notice]);

  // Downloads spent this sitting, so the ceiling shows as a notice rather than a plain-text page.
  const [spent, setSpent] = useState(0);
  const left = downloadsLeft === undefined ? Infinity : downloadsLeft - spent;

  // A guest has neither, and two dead buttons are worse than none.
  if (ended && !saveHref) return null;

  return (
    <>
      {/* A finished roll offers only Save: the album travels as the ZIP, not as the join link. */}
      {ended ? (
        <div className="flex gap-2">
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
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex">
            {/* An unusable camera stays in place and explains itself when tapped. */}
            {off ? (
              <button
                type="button"
                aria-disabled="true"
                aria-label="Take a photo"
                onClick={() => setNotice(off)}
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
          </div>

          {inviteHref || poolHref ? (
            <div className="flex gap-2">
              {inviteHref ? (
                <Link
                  href={inviteHref}
                  aria-label="Invite guests"
                  className={cn(tile, "bg-surface text-chalk hover:text-flame")}
                >
                  <Qr className="h-5 w-5" />
                  Invite
                </Link>
              ) : null}

              {poolHref ? (
                <Link
                  href={poolHref}
                  aria-label="Shots pool"
                  className={cn(tile, "bg-surface text-chalk hover:text-flame")}
                >
                  <Photo className="h-5 w-5" />
                  Shots pool
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

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
  const className = cn(tile, "bg-surface text-chalk hover:text-flame");

  // An API route serves a file, not a page, so it leaves through a plain anchor.
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
