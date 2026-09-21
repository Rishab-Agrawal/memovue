import { SampleAlbum } from "@/components/roll/SampleAlbum";
import { SAMPLE_ALBUM } from "@/lib/sample-album";

export const metadata = { title: SAMPLE_ALBUM.name };

/**
 * Where the sample camera's thumbnail leads: the roll still shooting. The camera is its button,
 * so back leaves the sample.
 */
export default function LiveSampleAlbumPage() {
  return <SampleAlbum back="/welcome" live />;
}
