import { PillLink } from "@/components/roll/Chrome";
import { Download, Link as LinkIcon } from "@/components/roll/Icons";
import { Sheet } from "@/components/roll/Sheet";
import { env } from "@/lib/env";
import { getRollForHost } from "@/lib/rolls";
import { qrDataUrl } from "@/lib/qr";
import { requireHost } from "@/lib/session";

import { loadRoll } from "../loadRoll";
import { RollBackdrop } from "../RollBackdrop";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: PageProps<"/rolls/[id]/invite">) {
  const { id } = await params;
  const user = await requireHost();
  const { roll, photos } = await loadRoll(id);

  const record = await getRollForHost(id, user.id);
  const joinUrl = `${env.appUrl}/j/${record?.code ?? ""}`;
  const qr = await qrDataUrl(joinUrl);

  return (
    <div className="relative min-h-dvh">
      <RollBackdrop roll={roll} photos={photos} />

      <Sheet
        title="Invite guests to your roll."
        subtitle="Take a glimpse of your world through their lens. Invite your guests to make this roll unforgettable."
      >
        <div className="mt-5 border-t border-hair pt-6">
          {/* A real, scannable code — unlike the prototype's placeholder, this one has
              somewhere to go. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt={`QR code linking to ${joinUrl}`}
            className="mx-auto h-[210px] w-[210px] rounded-2xl bg-white p-3"
          />
          <p className="tabular mt-4 text-center text-[13px] break-all text-dust">{joinUrl}</p>
        </div>

        <div className="mt-6 flex gap-3">
          <PillLink href={joinUrl} variant="quiet" full className="px-3 text-[14px]">
            <LinkIcon className="h-4 w-4" />
            Open link
          </PillLink>
          <PillLink href={qr} download={`memovue-${record?.code}.png`} variant="quiet" full className="px-3 text-[14px]">
            <Download className="h-4 w-4" />
            Save QR image
          </PillLink>
        </div>
      </Sheet>
    </div>
  );
}
