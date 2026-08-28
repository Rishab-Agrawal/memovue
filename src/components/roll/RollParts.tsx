import Link from "next/link";

import { Camera, Download, Lock, Qr, Send } from "@/components/roll/Icons";
import { Plate } from "@/components/roll/Plate";

/**
 * The pieces below the cover, shared by the host's roll home and the guest's album.
 */

export function RollControls({
  revealed,
  cameraHref,
  inviteHref,
  onCamera,
}: {
  revealed: boolean;
  cameraHref: string;
  inviteHref: string;
  /** When given, the camera closes a sheet instead of navigating — the guest app keeps its
      viewfinder alive underneath rather than tearing the stream down and back up. */
  onCamera?: () => void;
}) {
  if (revealed) {
    return (
      <div className="flex gap-3">
        <Control href="#" label="Send" icon={<Send className="h-5 w-5" />} wide />
        <Control href="#" label="Save" icon={<Download className="h-5 w-5" />} wide />
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      {onCamera ? (
        <button
          type="button"
          onClick={onCamera}
          aria-label="Take a photo"
          className="flex h-14 flex-1 items-center justify-center rounded-full bg-chalk text-void transition-colors hover:bg-white"
        >
          <Camera className="h-6 w-6" />
        </button>
      ) : (
        <Link
          href={cameraHref}
          aria-label="Take a photo"
          className="flex h-14 flex-1 items-center justify-center rounded-full bg-chalk text-void transition-colors hover:bg-white"
        >
          <Camera className="h-6 w-6" />
        </Link>
      )}

      <Link
        href={inviteHref}
        aria-label="Invite guests"
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-chalk transition-colors hover:text-flame"
      >
        <Qr className="h-5 w-5" />
      </Link>

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
  return (
    <Link
      href={href}
      className={`flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-surface text-[15px] text-chalk transition-colors hover:text-flame ${wide ? "flex-1" : ""}`}
    >
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

export function PhotoGrid({
  photos,
  sealed,
  revealsIn,
  photoHref,
}: {
  photos: { id: string; by: string; url: string | null; plate: number }[];
  sealed: boolean;
  revealsIn: string;
  photoHref: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {photos.map((photo) => {
        const tile = (
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
            {/*
              A gradient only while there is genuinely nothing to show. This grid drew one
              unconditionally, so a host who opened their own album after the reveal was shown
              abstract art where their guests' photographs should have been.

              Not next/image: the source is a presigned URL that changes on every render, which
              defeats the optimiser's cache and would proxy every frame through our own server.
            */}
            {photo.url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={photo.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <Plate index={photo.plate} className="absolute inset-0" sealed={sealed} />
            )}

            {sealed ? (
              <span className="tabular absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-void/60 px-3 py-1.5 text-[13px] whitespace-nowrap text-chalk">
                Reveals in {revealsIn}
              </span>
            ) : null}

            <span className="absolute bottom-3 left-3 text-[15px] text-chalk italic drop-shadow">
              {photo.by}
            </span>
          </div>
        );

        if (sealed) return <div key={photo.id}>{tile}</div>;

        return (
          <Link key={photo.id} href={photoHref} aria-label={`Photo by ${photo.by}`}>
            {tile}
          </Link>
        );
      })}
    </div>
  );
}
