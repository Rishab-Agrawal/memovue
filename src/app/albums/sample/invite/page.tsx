import { GuestInviteSheet } from "@/components/roll/InviteCard";
import { env } from "@/lib/env";
import { SAMPLE_ALBUM } from "@/lib/sample-album";

export const metadata = { title: SAMPLE_ALBUM.name };
export const dynamic = "force-dynamic";

/** The live sample's invitation, which hands out the sample rather than a roll. */
export default function SampleInvitePage() {
  return (
    <GuestInviteSheet
      back={`${SAMPLE_ALBUM.href}/live`}
      code="sample"
      link={`${env.appUrl}${SAMPLE_ALBUM.href}/join`}
    />
  );
}
