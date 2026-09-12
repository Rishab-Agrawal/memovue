import { redirect } from "next/navigation";

import { GuestApp } from "@/components/guest/GuestApp";
import { getGuestContext, rollHome } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { poolMoves } from "@/lib/roll-config";
import { poolLeft } from "@/lib/rolls";

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
  const [latest, pool] = await Promise.all([
    prisma.photo.findFirst({
      where: { guestId: context.guest.id },
      orderBy: { takenAt: "desc" },
      select: { blurData: true },
    }),
    poolLeft(context.roll),
  ]);

  return (
    <GuestApp
      code={context.roll.code}
      rollName={context.roll.name}
      shotsLeft={context.shotsLeft}
      // Their allowance, not the roll's flat rate: film taken from the pool is theirs, and
      // film given away is not — so the rule under the counter measures against what they
      // actually hold.
      shotsTotal={context.roll.photosPerGuest + context.guest.fromPool}
      pool={pool}
      /*
        Asked with an empty camera rather than their current one. The dialog is raised by the
        client the instant the last shot goes, off a page rendered while they still had film,
        so the number it needs is the one that will apply then. Every move is re-checked
        against the real count on the way in.
      */
      takeMax={poolMoves(context.roll, { ...context.guest, shotsLeft: 0 }, pool).take}
      // The camera closes itself on this, rather than only being refused entry next time the
      // page is loaded.
      finishesAt={context.roll.finishesAt.getTime()}
      home={await rollHome(context.roll)}
      latestBlur={latest?.blurData ?? null}
    />
  );
}
