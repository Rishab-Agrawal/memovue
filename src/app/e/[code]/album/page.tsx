import { redirect } from "next/navigation";
import { after } from "next/server";

import { AlbumView } from "@/components/guest/AlbumView";
import { getGuestContext, guestHome } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { sponsorFor } from "@/lib/referrals";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/e/[code]/album">) {
  const { code } = await params;
  const context = await getGuestContext(code);
  return { title: context ? context.roll.name : "MemoVue" };
}

/** The guest's view of the roll: `/rolls/[id]` without the host's settings. */
export default async function GuestAlbumPage({ params }: PageProps<"/e/[code]/album">) {
  const { code } = await params;

  const context = await getGuestContext(code);
  // No session for this roll — the join screen is where a name gets attached to a camera.
  if (!context) redirect(`/join/${code}`);

  // The first opening of an open album, recorded once. Guarded in the `where` too, so a race keeps the earlier time.
  if (context.open && !context.roll.albumOpenedAt) {
    after(() =>
      prisma.roll
        .updateMany({
          where: { id: context.roll.id, albumOpenedAt: null },
          data: { albumOpenedAt: new Date() },
        })
        .catch((error: unknown) => console.error("Could not mark album opened", error)),
    );
  }

  return (
    <div className="min-h-dvh bg-page">
      <div className="pt-[var(--safe-top)]">
        <AlbumView
          code={context.roll.code}
          back={await guestHome(context.roll)}
          cameraHref={context.capturing ? `/e/${context.roll.code}` : undefined}
          // Server-rendered rather than polled: the business behind a roll never changes.
          sponsor={await sponsorFor(context.roll)}
        />
      </div>
    </div>
  );
}
