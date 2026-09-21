import { PillLink } from "@/components/roll/Chrome";
import { Download } from "@/components/roll/Icons";
import { ShareLink } from "@/components/roll/ShareLink";
import { Sheet } from "@/components/roll/Sheet";
import { joinUrl, qrDataUrl } from "@/lib/qr";

/**
 * The QR, the link, and the two ways of passing them on.
 *
 * Both the host's sheet and the guest's render this. A code printed on a table is already out
 * of the host's hands, so a guest holding the roll handing it to the person beside them is
 * not a new leak — it is the same one, done deliberately.
 *
 * The link comes from `joinUrl` rather than being assembled here: one helper owns the shape
 * of a join link, and a code printed on a table has no second chance at it.
 */
export async function InviteCard({
  code,
  link = joinUrl(code),
}: {
  code: string;
  /** Where the QR leads. Given only by the sample, whose invitation is not a roll's. */
  link?: string;
}) {
  const qr = await qrDataUrl(link);

  return (
    <>
      <div className="mt-5 border-t border-hair pt-6">
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
          download={`memovue-${code}.png`}
          variant="quiet"
          full
          className="px-3 text-[14px]"
        >
          <Download className="h-4 w-4" />
          Save QR
        </PillLink>
      </div>
    </>
  );
}

/** The card as a guest opens it from their album, shared with the live sample's. */
export function GuestInviteSheet({ back, ...card }: { back: string; code: string; link?: string }) {
  return (
    <div className="min-h-dvh bg-page">
      <Sheet back={back} title="Invite people to this roll.">
        <InviteCard {...card} />
      </Sheet>
    </div>
  );
}
