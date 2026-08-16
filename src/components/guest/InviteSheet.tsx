import { PillLink } from "@/components/roll/Chrome";
import { Download, Link as LinkIcon } from "@/components/roll/Icons";
import { QrPlate } from "@/components/roll/QrPlate";
import { Sheet } from "@/components/roll/Sheet";
import { CameraView } from "./CameraView";

/** Guests can invite guests — the same sheet the host gets, reached from the camera header. */
export default function CameraInvite() {
  return (
    <div className="relative h-full">
      <CameraView />

      <Sheet
        title="Invite guests to your roll."
        subtitle="Take a glimpse of your world through their lens. Invite your guests to make this roll unforgettable."
      >
        <div className="mt-5 border-t border-hair pt-6">
          <QrPlate className="mx-auto h-[190px] w-[190px] rounded-2xl" />
        </div>

        <div className="mt-6 flex gap-3">
          <PillLink
            href="/proto/guest/camera/invite"
            variant="quiet"
            full
            className="px-3 text-[14px]"
          >
            <LinkIcon className="h-4 w-4" />
            Share Link
          </PillLink>
          <PillLink
            href="/proto/guest/camera/invite"
            variant="quiet"
            full
            className="px-3 text-[14px]"
          >
            <Download className="h-4 w-4" />
            Save QR image
          </PillLink>
        </div>
      </Sheet>
    </div>
  );
}
