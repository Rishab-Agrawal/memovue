import { redirect } from "next/navigation";

import { AlbumView } from "@/components/guest/AlbumView";
import { QueueStatusLine } from "@/components/guest/QueueStatusLine";
import { getGuestContext, guestHome } from "@/lib/guest-context";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/e/[code]/album">) {
  const { code } = await params;
  const context = await getGuestContext(code);
  return { title: context ? context.roll.name : "MemoVue" };
}

/**
 * The roll, for whoever is holding its camera.
 *
 * This is the guest's half of `/rolls/[id]` — the same cover, the same figures, the same wall
 * of frames, minus the settings and the invite QR that are the host's alone. It used to be a
 * sheet that slid up over the live viewfinder, reachable only from inside the camera, which
 * meant a guest without an account had no roll screen at all: the camera's back arrow led
 * nowhere for them, and the whole roll existed only as an overlay.
 *
 * A route instead. Anonymous guests get the same screen as everyone else, the back gesture is
 * the browser's own, and the camera no longer has to hold a second screen inside itself.
 */
export default async function GuestAlbumPage({ params }: PageProps<"/e/[code]/album">) {
  const { code } = await params;

  const context = await getGuestContext(code);
  // No session for this roll — the join screen is where a name gets attached to a camera.
  if (!context) redirect(`/join/${code}`);

  return (
    <div className="min-h-dvh bg-page">
      <div className="pt-[var(--safe-top)]">
        <QueueStatusLine code={context.roll.code} />
        <AlbumView
          code={context.roll.code}
          // Back out of the roll entirely: their own list, or the page they arrived past.
          back={await guestHome(context.roll)}
          // The camera is a sibling route now, so this is a link rather than a sheet toggle.
          cameraHref={context.capturing ? `/e/${context.roll.code}` : undefined}
        />
      </div>
    </div>
  );
}
