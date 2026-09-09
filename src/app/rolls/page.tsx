import Link from "next/link";

import { Logo } from "@/components/ui/Logo";
import { BottomNav } from "@/components/roll/BottomNav";
import { PillLink } from "@/components/roll/Chrome";
import { Cover } from "@/components/roll/Cover";
import { Person, Qr } from "@/components/roll/Icons";
import { canCreateRoll } from "@/lib/beta";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { type RollCard, coverUrlsFor, listRollsForUser } from "@/lib/rolls";
import { requireHost } from "@/lib/session";

import { NewRollButton } from "./NewRollButton";

export const metadata = { title: "Your rolls" };
export const dynamic = "force-dynamic";

/** Your own roll opens the host screen; one you were invited to opens the camera. */
const destination = (roll: RollCard) =>
  roll.invitedBy ? `/e/${roll.code}` : `/rolls/${roll.id}`;

/**
 * Home is what is running right now, and the two ways to start something.
 *
 * Albums moved to their own tab. They were the bottom half of this screen, competing for the
 * same scroll as the rolls still shooting — two lists on two different clocks, and the one
 * you open the app to check was the one you had to scroll past the other to reach.
 *
 * The two controls move with the answer. On an empty screen there is nothing to do but start
 * something, so they take the middle at full size; once a roll is running they are no longer
 * the point and retreat into the header, leaving the covers the whole screen.
 */
export default async function RollsHome() {
  const user = await requireHost();
  const [{ active }, canCreate] = await Promise.all([
    // Albums are a screen of their own now, and their prints cost a query each.
    listRollsForUser(user.id, { thumbs: false }),
    canCreateRoll(user),
  ]);
  const covers = coverUrlsFor(active);
  const now = new Date();
  const running = active.length > 0;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 px-5 pt-[calc(var(--safe-top)+1.5rem)] pb-2">
        <Link
          href="/rolls"
          aria-label="MemoVue home"
          className="flex h-11 min-w-0 items-center"
        >
          <Logo wordmarkClassName={running ? "text-[17px]" : undefined} />
        </Link>

        {running ? <Actions canCreate={canCreate} hostName={user.name} compact /> : null}
      </header>

      <main className="flex-1 overflow-y-auto px-5 pb-6">
        {running ? (
          <section className="pt-4">
            <h2 className="marking text-[13px] tracking-[0.2em]">Active rolls</h2>

            {/*
              Two up, and portrait. The covers are portrait pictures — the shipped ones, and
              anything a host uploads through the same picker — so a wide landscape card was
              cropping away most of every one of them to show a letterbox slice.
            */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {active.map((roll) => (
                <ActiveCard
                  key={roll.id}
                  roll={roll}
                  coverUrl={covers.get(roll.id)}
                  now={now}
                />
              ))}
            </div>
          </section>
        ) : (
          <div className="flex min-h-full flex-col justify-center">
            <p className="mb-8 text-center text-[15px] text-dust">No active rolls</p>
            <Actions canCreate={canCreate} hostName={user.name} />
          </div>
        )}
      </main>

      <BottomNav current="rolls" />
    </div>
  );
}

/**
 * The only two things anybody comes to this screen to do, at one of two sizes: the middle of
 * an empty screen, or a pair of pills in the corner of a busy one.
 */
function Actions({
  canCreate,
  hostName,
  compact,
}: {
  canCreate: boolean;
  hostName: string;
  compact?: boolean;
}) {
  const pill = compact ? "h-10 px-3.5 text-[13px]" : "h-14 w-full";

  return (
    <div
      className={cn(
        "flex shrink-0",
        compact ? "gap-2" : "mx-auto w-full max-w-[22rem] flex-col gap-3",
      )}
    >
      <NewRollButton canCreate={canCreate} hostName={hostName} variant="flame" className={pill}>
        + Create roll
      </NewRollButton>
      <PillLink href="/join" variant="quiet" className={pill}>
        <Qr className="h-4 w-4" />
        Join a roll
      </PillLink>
    </div>
  );
}

/**
 * One running roll.
 *
 * Portrait at the covers' own proportions, so the picture a host chose is the picture they
 * see. The perforated left edge is the strip's own: nothing else in the app carries it, so it
 * means "this is a roll, and it is still running".
 */
function ActiveCard({
  roll,
  coverUrl,
  now,
}: {
  roll: RollCard;
  coverUrl?: string | null;
  now: Date;
}) {
  return (
    <Link
      href={destination(roll)}
      className="relative block aspect-[9/16] overflow-hidden rounded-2xl bg-void"
    >
      <Cover url={coverUrl} preset={roll.coverPreset} className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-void via-void/40 to-transparent" />
      {/* A dark band under the holes, not bare holes on the picture. Floating over a bright
          cover they read as damage; over the strip they read as the edge of film. */}
      <span aria-hidden="true" className="perf absolute inset-y-0 left-0 w-4 bg-void/55" />

      <div className="absolute inset-x-0 bottom-0 pr-3 pb-3 pl-6">
        <p className="display-sm line-clamp-2 text-[15px] text-chalk">{roll.name}</p>
        <p className="tabular mt-1 text-[12px] text-chalk/75">
          {formatDuration(roll.finishesAt.getTime() - now.getTime())} left
        </p>
        {roll.invitedBy ? (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-chalk/55">
            <Person className="h-3 w-3 shrink-0" />
            <span className="truncate">{roll.invitedBy}</span>
          </p>
        ) : null}
      </div>
    </Link>
  );
}
