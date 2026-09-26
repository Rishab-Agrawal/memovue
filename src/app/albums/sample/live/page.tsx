import { AlbumScreen } from "@/components/guest/AlbumView";
import { computeKeptUntil } from "@/lib/roll-access";
import { SAMPLE_ALBUM, SAMPLE_CLOSES_IN_MS, SAMPLE_SHOTS } from "@/lib/sample-album";

export const metadata = { title: SAMPLE_ALBUM.name };

const { finishesAt } = SAMPLE_ALBUM;

/**
 * Where the sample camera's thumbnail leads: a guest's own roll home, fed a roll that opens as
 * it is shot and is always a day from closing, as a signed-in guest sees it. Back leaves the
 * sample.
 */
export default function LiveSampleAlbumPage() {
  return (
    <div className="min-h-dvh bg-page">
      <div className="pt-[var(--safe-top)]">
        <AlbumScreen
          feed={{
            open: true,
            capturing: true,
            uploads: false,
            rollName: SAMPLE_ALBUM.name,
            everyoneCanSee: true,
            // A roll revealed as it is shot stores its close as the reveal.
            revealAt: finishesAt.toISOString(),
            finishesAt: finishesAt.toISOString(),
            keptUntil: computeKeptUntil(finishesAt).toISOString(),
            totalPhotos: SAMPLE_ALBUM.photos.length,
            guestCount: SAMPLE_ALBUM.guests,
            poolLeft: 0,
            me: { shotsLeft: SAMPLE_SHOTS, refill: 0, linked: true },
          }}
          photos={SAMPLE_ALBUM.photos.map(({ id, by, src }) => ({
            id,
            by,
            blurData: "",
            previewUrl: src,
            fullUrl: src,
          }))}
          now={finishesAt.getTime() - SAMPLE_CLOSES_IN_MS}
          back="/welcome"
          cameraHref={`${SAMPLE_ALBUM.href}/camera`}
          inviteHref={`${SAMPLE_ALBUM.href}/invite`}
        />
      </div>
    </div>
  );
}
