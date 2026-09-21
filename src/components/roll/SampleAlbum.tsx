import { PhotoGrid } from "@/components/roll/PhotoGrid";
import { RollHeader } from "@/components/roll/RollHeader";
import { RollControls } from "@/components/roll/RollParts";
import type { Sponsor } from "@/lib/referrals";
import { SAMPLE_ALBUM, SAMPLE_CLOSES_IN_MS, SAMPLE_PHOTOS } from "@/lib/sample-album";

/**
 * The sample album, as a host would see one of their own.
 *
 * The same header and the same wall as a real roll — the point is to show the screen, not a
 * picture of it. Of the row of controls it keeps only the live one's camera: nobody hosts this,
 * and Save would hand out a ZIP of our own stock photography.
 *
 * It is a component rather than a page because there are three of them: the open one every
 * host can open, the live one the sample camera leads to, and an admin-only copy carrying a
 * made-up sponsor card, screenshotted and sent to the wedding businesses being pitched to.
 * They have to be the same screen or the screenshot is a promise about a page that does not
 * exist.
 */
export function SampleAlbum({
  back,
  live = false,
  sponsor,
}: {
  back: string;
  /** Still shooting, revealed as it goes, as a guest fresh from the camera sees it. */
  live?: boolean;
  /** The made-up business on the admin copy. Absent on the one hosts see. */
  sponsor?: Sponsor | null;
}) {
  const ended = SAMPLE_ALBUM.finishesAt.getTime();
  // A fixed clock, so the header renders the same at any hour.
  const now = live ? ended - SAMPLE_CLOSES_IN_MS : ended;

  return (
    <div className="flex min-h-dvh flex-col">
      <RollHeader
        title={SAMPLE_ALBUM.name}
        moments={SAMPLE_PHOTOS.length}
        people={SAMPLE_ALBUM.guests}
        finishesAt={ended}
        revealAt={ended}
        open
        now={now}
        back={back}
        sponsor={sponsor}
      />

      <div className="space-y-4 px-5 pt-4 pb-6">
        {live ? <RollControls ended={false} cameraHref={`${SAMPLE_ALBUM.href}/camera`} /> : null}

        <PhotoGrid photos={SAMPLE_PHOTOS} sealed={false} revealsIn="" />

        <p className="text-center text-[12px] text-dust">
          A sample album, so you can see how yours will look.
        </p>
      </div>
    </div>
  );
}
