import { PillLink } from "@/components/roll/Chrome";
import { Download } from "@/components/roll/Icons";
import { ShareLink } from "@/components/roll/ShareLink";
import { Sheet } from "@/components/roll/Sheet";
import { joinUrl, qrDataUrl } from "@/lib/qr";

import { BACKDROP_PHOTOS, loadRoll } from "../loadRoll";
import { RollBackdrop } from "../RollBackdrop";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: PageProps<"/rolls/[id]/invite">) {
  const { id } = await params;
  const { roll, photos } = await loadRoll(id, BACKDROP_PHOTOS);

  /*
    Built by `joinUrl` rather than assembled here.

    This page used to compose its own `${appUrl}/j/${code}`, and there has never been a `/j`
    route — so every QR printed for a table and every link copied out of this sheet sent the
    guest to a 404. One helper owns the shape of a join link now, and the printable card in
    `qrSvg` already went through it.
  */
  const link = joinUrl(roll.code);
  const qr = await qrDataUrl(link);

  return (
    <div className="relative min-h-dvh">
      <RollBackdrop roll={roll} photos={photos} />

      <Sheet
        back={`/rolls/${roll.id}`}
        title="Invite guests to your roll."
      >
        <div className="mt-5 border-t border-hair pt-6">
          {/* A real, scannable code — unlike the prototype's placeholder, this one has
              somewhere to go. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt={`QR code linking to ${link}`}
            className="mx-auto h-[210px] w-[210px] rounded-2xl bg-white p-3"
          />
          <p className="tabular mt-4 text-center text-[13px] break-all text-dust">{link}</p>
        </div>

        <div className="mt-6 flex gap-3">
          <ShareLink url={link} />
          <PillLink
            href={qr}
            download={`memovue-${roll.code}.png`}
            variant="quiet"
            full
            className="px-3 text-[14px]"
          >
            <Download className="h-4 w-4" />
            Save QR
          </PillLink>
        </div>
      </Sheet>
    </div>
  );
}
