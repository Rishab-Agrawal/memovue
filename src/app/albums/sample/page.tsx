import { SampleAlbum } from "@/components/roll/SampleAlbum";
import { SAMPLE_ALBUM } from "@/lib/sample-album";

export const metadata = { title: SAMPLE_ALBUM.name };

/** The sample every host can open from the Albums tab. No sponsor: nobody referred this one. */
export default function SampleAlbumPage() {
  return <SampleAlbum back="/albums" />;
}
