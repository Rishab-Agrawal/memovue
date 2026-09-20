import { PhotoGrid } from "@/components/roll/PhotoGrid";
import { RollHeader } from "@/components/roll/RollHeader";
import type { Sponsor } from "@/lib/referrals";
import { SAMPLE_ALBUM, SAMPLE_PHOTOS } from "@/lib/sample-album";

/**
 * The sample album, as a host would see one of their own.
 *
 * The same header and the same wall as a real roll — the point is to show the screen, not a
 * picture of it. What it has none of is the row of controls: the shutter closed months ago,
 * nobody hosts this, and Save would hand out a ZIP of our own stock photography.
 *
 * It is a component rather than a page because there are two of them: the one every host can
 * open, and an admin-only copy carrying a made-up sponsor card, screenshotted and sent to the
 * wedding businesses being pitched to. They have to be the same screen or the screenshot is a
 * promise about a page that does not exist.
 */
export function SampleAlbum({
  back,
  sponsor,
}: {
  back: string;
  /** The made-up business on the admin copy. Absent on the one hosts see. */
  sponsor?: Sponsor | null;
}) {
  const ended = SAMPLE_ALBUM.finishesAt.getTime();

  return (
    <div className="flex min-h-dvh flex-col">
      <RollHeader
        title={SAMPLE_ALBUM.name}
        moments={SAMPLE_PHOTOS.length}
        people={SAMPLE_ALBUM.guests}
        finishesAt={ended}
        revealAt={ended}
        open
        // The clock is only read to ask whether the roll is still shooting. This one closed in
        // February, so the answer is fixed and the header renders the same at any hour.
        now={ended}
        back={back}
        sponsor={sponsor}
      />

      <div className="space-y-4 px-5 pt-4 pb-6">
        <PhotoGrid photos={SAMPLE_PHOTOS} sealed={false} revealsIn="" />

        <p className="text-center text-[12px] text-dust">
          A sample album, so you can see how yours will look.
        </p>
      </div>
    </div>
  );
}
