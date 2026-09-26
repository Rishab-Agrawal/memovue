"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Camera, Download, Lock, Photo, Qr, Upload } from "@/components/roll/Icons";
import { useToast } from "@/components/roll/Toast";
import { UploadButton } from "@/components/roll/UploadButton";
import { cn } from "@/lib/cn";
import { SHOTS_HELD, SHOTS_SPENT, ZIP_DOWNLOAD_SPENT } from "@/lib/constants";
import { SHOTS_POOL } from "@/lib/roll-config";
import { enqueuePhoto, subscribeQueue } from "@/lib/upload-queue";

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
  uploads,
  uploadOff,
  inviteHref,
  poolHref,
  poolLeft = 0,
  refill = 0,
  saveHref,
  downloadsLeft,
  cameraOff,
}: {
  /** Whether the shutter has closed: a running roll offers camera and invite, a finished one Save. */
  ended: boolean;
  /** This roll's join code, so the queue's counts can be told apart from another roll's. */
  code?: string;
  /** Film left as the server counted it; read together with the upload queue below. */
  shotsLeft?: number;
  cameraHref?: string;
  /** Whether the host lets photos in from the library. Needs `code`, the queue they go into. */
  uploads?: boolean;
  /** Why the library cannot be used yet. Said when tapped. */
  uploadOff?: string;
  /** Drawn in a row of their own under the camera. The guest's are in the header instead. */
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
  const filmLeft = Math.max(0, (shotsLeft ?? 0) - unreserved);
  const filmSpent = shotsLeft !== undefined && filmLeft <= 0;
  const spent = poolLeft > 0 ? SHOTS_HELD : SHOTS_SPENT;
  const off = cameraOff ?? (filmSpent && refill <= 0 ? spent : undefined);
  const libraryOff = uploadOff ?? (filmSpent ? spent : undefined);

  const [say, toast] = useToast();

  // Downloads spent this sitting, so the ceiling shows as a notice rather than a plain-text page.
  const [saved, setSaved] = useState(0);
  const left = downloadsLeft === undefined ? Infinity : downloadsLeft - saved;

  const upload =
    uploads && code ? (
      <UploadButton
        left={filmLeft}
        off={libraryOff}
        onPicked={(photo) => void enqueuePhoto(code, photo)}
        className={cn(tile, libraryOff ? "bg-surface text-dust/60" : "bg-surface text-chalk hover:text-flame")}
      >
        <Upload className="h-5 w-5" />
        Upload
      </UploadButton>
    ) : null;

  // A guest has no Save, and a dead row is worse than none.
  if (ended && !saveHref && !upload) return null;

  const invite = inviteHref ? (
    <Link
      href={inviteHref}
      aria-label="Invite guests"
      className={cn(tile, "bg-surface text-chalk hover:text-flame")}
    >
      <Qr className="h-5 w-5" />
      Invite
    </Link>
  ) : null;

  return (
    <>
      {/* A finished roll offers Save and the library: the album travels as the ZIP, not as the join link. */}
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
                  say(ZIP_DOWNLOAD_SPENT);
                  return;
                }
                setSaved((count) => count + 1);
                say("Building your album — the download starts on its own. Big rolls take a minute.");
              }}
            />
          ) : null}
          {upload}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            {/* An unusable camera stays in place and explains itself when tapped. */}
            {off ? (
              <button
                type="button"
                aria-disabled="true"
                aria-label="Take a photo"
                onClick={() => say(off)}
                className={cn(tile, "bg-surface text-dust/60")}
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

            {upload}
          </div>

          {inviteHref || (SHOTS_POOL && poolHref) ? (
            <div className="flex gap-2">
              {invite}

              {SHOTS_POOL && poolHref ? (
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

      {toast}
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
