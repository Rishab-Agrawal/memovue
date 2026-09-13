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

  // The shutter is closed, so there is no camera to show.
  if (!context.capturing) redirect(`/e/${context.roll.code}/album`);

  // The last shot's blur fills the thumbnail before the first tap: one small row, no image fetch.
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
      // Their allowance, including film drawn from or given to the pool.
      shotsTotal={context.roll.photosPerGuest + context.guest.fromPool}
      pool={pool}
      // Asked with an empty camera, since the dialog appears once the last shot is spent.
      takeMax={poolMoves(context.roll, { ...context.guest, shotsLeft: 0 }, pool).take}
      finishesAt={context.roll.finishesAt.getTime()}
      home={await rollHome(context.roll)}
      latestBlur={latest?.blurData ?? null}
    />
  );
}
