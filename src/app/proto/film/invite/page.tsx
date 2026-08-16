"use client";

import { useSearchParams } from "next/navigation";

import { PillLink } from "../../components/Chrome";
import { Dialog } from "../../components/Dialog";
import { Download, Link as LinkIcon } from "../../components/Icons";
import { QrPlate } from "../../components/QrPlate";
import { Sheet } from "../../components/Sheet";
import { FilmBackdrop } from "../FilmBackdrop";

export default function InviteGuests() {
  const saved = useSearchParams().get("v") === "saved";

  return (
    <div className="relative min-h-full">
      <FilmBackdrop />

      <Sheet
        title="Invite guests to your film."
        subtitle="Take a glimpse of your world through their lens. Invite your guests to make this film unforgettable."
      >
        <div className="mt-5 border-t border-hair pt-6">
          <QrPlate className="mx-auto h-[210px] w-[210px] rounded-2xl" />
        </div>

        <div className="mt-6 flex gap-3">
          <PillLink href="/proto/film/invite" variant="quiet" full className="px-3 text-[14px]">
            <LinkIcon className="h-4 w-4" />
            Share Link
          </PillLink>
          <PillLink
            href="/proto/film/invite?v=saved"
            variant="quiet"
            full
            className="px-3 text-[14px]"
          >
            <Download className="h-4 w-4" />
            Save QR image
          </PillLink>
        </div>
      </Sheet>

      <Dialog
        open={saved}
        title="Success"
        actions={
          <PillLink href="/proto/film/invite" variant="quiet" full>
            OK
          </PillLink>
        }
      >
        QR code saved to your photos!
      </Dialog>
    </div>
  );
}
