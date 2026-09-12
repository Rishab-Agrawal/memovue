import { redirect } from "next/navigation";

import { getGuestContext, rollHome } from "@/lib/guest-context";
import { giveawayOffered, poolMoves } from "@/lib/roll-config";
import { poolLeft } from "@/lib/rolls";

import { PoolScreen } from "./PoolScreen";

export const dynamic = "force-dynamic";

/**
 * The roll's unclaimed film, for whoever is holding its camera — host included.
 *
 * One screen for both, reached from the roll home and from the counter in the corner of the
 * viewfinder. The host's roll screen links here by the roll's code like the camera does,
 * because the pool is a fact about the roll rather than about who is looking at it.
 */
export default async function PoolPage({ params, searchParams }: PageProps<"/e/[code]/pool">) {
  const [{ code }, query] = await Promise.all([params, searchParams]);

  const context = await getGuestContext(code);
  // No session for this roll — the join screen is where a name gets attached to a camera.
  if (!context) redirect(`/join/${code}`);
  // Nothing to share out while the shutter is shut — before the roll opens or after it ends.
  // Back to the roll's own screen, which for the host is theirs rather than the guest album.
  if (!context.capturing) redirect(await rollHome(context.roll));

  const pool = await poolLeft(context.roll);
  const { give, back } = poolMoves(
    context.roll,
    { fromPool: context.guest.fromPool, shotsLeft: context.shotsLeft },
    pool,
  );

  return (
    <PoolScreen
      code={context.roll.code}
      /*
        Back to whichever screen opened this. Only the camera says so, because the roll home
        is where everybody else came from — and `rollHome` already knows whether that is the
        host's screen or the guest album.
      */
      back={query.from === "camera" ? `/e/${context.roll.code}` : await rollHome(context.roll)}
      pool={pool}
      shotsLeft={context.shotsLeft}
      give={give}
      reclaim={back}
      offered={giveawayOffered(context.roll)}
    />
  );
}
