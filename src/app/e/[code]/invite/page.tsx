import { redirect } from "next/navigation";

import { InviteCard } from "@/components/roll/InviteCard";
import { Sheet } from "@/components/roll/Sheet";
import { getGuestContext } from "@/lib/guest-context";

export const dynamic = "force-dynamic";

/**
 * The same invitation the host has, in a guest's hands.
 *
 * The QR is printed on the tables and passed between phones long before it reaches anybody we
 * could call the host, so keeping the button on one screen only ever made the person standing
 * beside a new arrival walk them over to it. The roll's own cap is what limits who gets in.
 */
export default async function GuestInvitePage({ params }: PageProps<"/e/[code]/invite">) {
  const { code } = await params;

  const context = await getGuestContext(code);
  // No session for this roll — the join screen is where a name gets attached to a camera.
  if (!context) redirect(`/join/${code}`);
  // A closed roll has nobody left to invite.
  if (!context.capturing) redirect(`/e/${context.roll.code}/album`);

  return (
    <div className="min-h-dvh bg-page">
      <Sheet back={`/e/${context.roll.code}/album`} title="Invite people to this roll.">
        <InviteCard code={context.roll.code} />
      </Sheet>
    </div>
  );
}
