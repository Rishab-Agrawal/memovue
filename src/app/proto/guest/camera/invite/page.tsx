import { PillLink } from "../../../components/Chrome";
import { Download, Link as LinkIcon } from "../../../components/Icons";
import { QrPlate } from "../../../components/QrPlate";
import { Sheet } from "../../../components/Sheet";
import { CameraScreen } from "../CameraScreen";

/** Guests can invite guests — the same sheet the host gets, reached from the camera header. */
export default function CameraInvite() {
  return (
    <div className="relative h-full">
      <CameraScreen />

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
