import { redirect } from "next/navigation";

import { GuestApp } from "@/components/guest/GuestApp";
import { getGuestContext, rollHome } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/e/[code]">) {
  const { code } = await params;
  const context = await getGuestContext(code);
  return { title: context ? context.roll.name : "MemoVue" };
}

export default async function GuestRollPage({ params }: PageProps<"/e/[code]">) {
  const { code } = await params;

  const context = await getGuestContext(code);
  // No session for this roll — the join screen is where a name gets attached to a camera.
  if (!context) redirect(`/join/${code}`);

  // The shutter is closed, so this route has nothing to render. The album is its own page now
  // and is what a roll becomes; sending people there beats a viewfinder that cannot shoot.
  if (!context.capturing) redirect(`/e/${context.roll.code}/album`);

  /*
    The thumbnail beside the shutter, filled before the first tap. Without it a guest coming
    back to a roll they have already shot half of is met by an empty square, which reads as a
    camera that has lost their photographs. The blur is the whole record we keep inline, so
    this costs one small row and no image fetch.
  */
  const latest = await prisma.photo.findFirst({
    where: { guestId: context.guest.id },
    orderBy: { takenAt: "desc" },
    select: { blurData: true },
  });

  return (
    <GuestApp
      code={context.roll.code}
      rollName={context.roll.name}
      shotsLeft={context.shotsLeft}
      home={await rollHome(context.roll)}
      latestBlur={latest?.blurData ?? null}
    />
  );
}
