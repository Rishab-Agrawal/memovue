import { SampleAlbum } from "@/components/roll/SampleAlbum";
import { SAMPLE_ALBUM } from "@/lib/sample-album";

export const metadata = { title: SAMPLE_ALBUM.name };

/** Where the sample camera's thumbnail leads: the roll still shooting, back to the camera. */
export default function LiveSampleAlbumPage() {
  return <SampleAlbum back={`${SAMPLE_ALBUM.href}/camera`} live />;
}
