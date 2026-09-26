import { SampleAlbum } from "@/components/roll/SampleAlbum";
import { sampleSponsor } from "@/lib/referrals";
import { SAMPLE_ALBUM } from "@/lib/sample-album";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: SAMPLE_ALBUM.name };
export const dynamic = "force-dynamic";

/**
 * The picture sent to a wedding business: the sample album, with their card on it.
 *
 * Nothing on this screen may say "admin". It gets screenshotted and emailed to somebody being
 * pitched to, so the only chrome is the back arrow every album has — the settings gear lives
 * on the account screen instead, where it cannot end up in the frame.
 */
export default async function SamplePitchPage() {
  await requireAdmin();

  return (
    <SampleAlbum
      back="/admin/sample"
      sponsor={await sampleSponsor()}
    />
  );
}
