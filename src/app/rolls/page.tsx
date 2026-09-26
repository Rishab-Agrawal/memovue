import Link from "next/link";

import { Logo } from "@/components/ui/Logo";
import { BottomNav } from "@/components/roll/BottomNav";
import { PillLink } from "@/components/roll/Chrome";
import { Cover } from "@/components/roll/Cover";
import { Person, Qr } from "@/components/roll/Icons";
import { LiveRefresh } from "@/components/roll/LiveRefresh";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { type RollCard, coverUrlFor, listRollsForUser } from "@/lib/rolls";
import { requireHost } from "@/lib/session";

export const metadata = { title: "Your rolls" };
export const dynamic = "force-dynamic";

/** Your own roll opens the host screen; one you were invited to opens the camera. */
const destination = (roll: RollCard) =>
  roll.invitedBy ? `/e/${roll.code}` : `/rolls/${roll.id}`;

/**
 * Home is what is running right now, and the two ways to start something. With nothing running
 * the two controls take the middle of the screen; otherwise they retreat into the header.
 */
export default async function RollsHome() {
  const user = await requireHost();
  // Albums are their own screen, and their prints cost a query each.
  const { active } = await listRollsForUser(user.id, { thumbs: false });
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

        {running ? <Actions compact /> : null}
      </header>

      <main className="flex-1 overflow-y-auto px-5 pb-6">
        {running ? (
          <section className="pt-4">
            <h2 className="marking text-[13px] tracking-[0.2em]">Active rolls</h2>

            {/* Two up and portrait, because the covers are portrait pictures. */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {active.map((roll) => (
                <ActiveCard key={roll.id} roll={roll} coverUrl={coverUrlFor(roll)} now={now} />
              ))}
            </div>
          </section>
        ) : (
          <div className="flex min-h-full flex-col justify-center">
            <p className="mb-8 text-center text-[15px] text-dust">No active rolls</p>
            <Actions />
          </div>
        )}
      </main>

      <BottomNav current="rolls" />

      {/* Each card counts down, and a roll that finishes moves to Albums. */}
      {running ? <LiveRefresh /> : null}
    </div>
  );
}

/** Create and Join, full size on an empty screen or as pills in the header. */
function Actions({ compact }: { compact?: boolean }) {
  const pill = compact ? "h-10 px-3.5 text-[13px]" : "h-14 w-full";

  return (
    <div
      className={cn(
        "flex shrink-0",
        compact ? "gap-2" : "mx-auto w-full max-w-[22rem] flex-col gap-3",
      )}
    >
      <PillLink href="/new/name" variant="flame" className={pill}>
        + Create roll
      </PillLink>
      <PillLink href="/join" variant="quiet" className={pill}>
        <Qr className="h-4 w-4" />
        {compact ? "Join" : "Join a roll"}
      </PillLink>
    </div>
  );
}

/** One running roll, at the covers' own proportions. */
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
      className="relative block aspect-[9/16] overflow-hidden rounded-2xl bg-void transition-[scale] duration-150 active:scale-[0.97]"
    >
      <Cover url={coverUrl} preset={roll.coverPreset} className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-void via-void/40 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 px-3 pb-3 text-center">
        <p className="display-sm line-clamp-2 text-[15px] text-chalk">{roll.name}</p>
        <p className="tabular mt-1 text-[12px] text-chalk/75">
          {formatDuration(roll.finishesAt.getTime() - now.getTime())} left
        </p>
        {roll.invitedBy ? (
          <p className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-chalk/55">
            <Person className="h-3 w-3 shrink-0" />
            <span className="truncate">{roll.invitedBy}</span>
          </p>
        ) : null}
      </div>
    </Link>
  );
}
