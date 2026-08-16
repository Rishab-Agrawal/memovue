import { CloseButton, Pill } from "@/components/roll/Chrome";
import { Download } from "@/components/roll/Icons";
import { Plate } from "@/components/roll/Plate";
import { formatStamp } from "@/lib/format";
import { PHOTOS } from "@/lib/mock-REMOVED";

/**
 * The reference puts Save on the left and pairs it with a share button and an overflow menu.
 * Ours drops both: sharing is the browser's job on a page that is already a URL, and there
 * is nothing left for a menu to hold. One action, centred.
 */
export default function PhotoViewer() {
  const photo = PHOTOS[1];

  return (
    <div className="flex h-full flex-col bg-void">
      <header className="flex items-start justify-between gap-4 px-5 pt-5">
        <div>
          <p className="display-md text-[22px] text-chalk italic">{photo.by}</p>
          <p className="mt-1 text-[14px] text-dust">{formatStamp(photo.takenAt)}</p>
        </div>
        <CloseButton href="/proto/guest/album?v=after-everyone" />
      </header>

      <div className="flex flex-1 items-center px-5">
        <Plate index={photo.plate} className="aspect-[4/5] w-full" />
      </div>

      <div className="flex justify-center px-5 pt-4 pb-8">
        <Pill variant="quiet">
          <Download className="h-4 w-4" />
          Save
        </Pill>
      </div>
    </div>
  );
}
