import { cn } from "@/lib/cn";

import { Plate } from "@/components/roll/Plate";

/**
 * Whatever is standing behind a roll's title.
 *
 * Two things can be: an image the host uploaded, or one of the nine preset gradients. Every
 * screen that shows a cover goes through here, so the fallback rule lives in one place — a
 * roll whose upload failed, or whose signed URL could not be minted, quietly shows its preset
 * instead of a broken frame.
 *
 * `Plate` stays as it was. It is also the stand-in for individual photographs, and a cover is
 * only one of the things it draws.
 */
export function Cover({
  url,
  preset,
  className,
  sealed,
}: {
  /** A signed, short-lived R2 link. Null means this roll is using its preset. */
  url?: string | null;
  preset: number;
  className?: string;
  sealed?: boolean;
}) {
  if (!url) return <Plate index={preset} className={className} sealed={sealed} />;

  return (
    <div className={cn("relative overflow-hidden bg-void", className)} aria-hidden="true">
      {/*
        Not next/image: the source is a presigned URL that changes on every render, which
        defeats the optimiser's cache and would proxy every cover through our own server for
        no benefit.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="h-full w-full object-cover"
        style={sealed ? { filter: "blur(16px) saturate(0.55)", transform: "scale(1.15)" } : undefined}
      />
    </div>
  );
}
