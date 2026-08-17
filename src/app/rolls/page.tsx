import Link from "next/link";

import { Logo } from "@/components/ui/Logo";
import { BottomNav } from "@/components/roll/BottomNav";
import { PillLink } from "@/components/roll/Chrome";
import { Cover } from "@/components/roll/Cover";
import { Camera, Clock, Qr } from "@/components/roll/Icons";
import { formatRange } from "@/lib/format";
import { formatDuration } from "@/lib/format";
import { coverUrlsFor, listRollsForHost } from "@/lib/rolls";
import { requireHost } from "@/lib/session";

export const metadata = { title: "Your rolls" };
export const dynamic = "force-dynamic";

/** Just enough tilt to read as separate prints rather than one strip. */
const TILT = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2"];

export default async function RollsHome() {
  const user = await requireHost();
  const { active, albums } = await listRollsForHost(user.id);
  const covers = await coverUrlsFor([...active, ...albums]);
  const now = new Date();

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex-1 overflow-y-auto">
        <header className="flex items-center justify-between px-5 pt-6 pb-4">
          <Link href="/rolls" aria-label="MemoVue home" className="flex h-11 items-center">
            <Logo />
          </Link>

          <div className="flex items-center gap-2">
            <PillLink href="/join" variant="quiet" className="h-10 px-4 text-[14px]">
              <Qr className="h-4 w-4" />
              Join
            </PillLink>
            <PillLink href="/new/name" variant="light" className="h-10 px-4 text-[14px] font-semibold">
              + New
            </PillLink>
          </div>
        </header>

        <section className="px-5 pb-8">
          <h2 className="marking">Active</h2>

          {active.length === 0 ? (
            <div className="flex flex-col items-center gap-5 py-16">
              <span className="h-7 w-7 rounded-full bg-hair-bright" />
              <p className="text-[15px] text-dust">No active rolls</p>
              <PillLink href="/new/name" variant="flame">
                + Create roll
              </PillLink>
            </div>
          ) : (
            <div className="mt-4 flex gap-4 overflow-x-auto no-scrollbar">
              {active.map((roll) => (
                <Link
                  key={roll.id}
                  href={`/rolls/${roll.id}`}
                  className="relative block h-[260px] w-[200px] shrink-0 overflow-hidden rounded-3xl"
                >
                  <Cover
                    url={covers.get(roll.id)}
                    preset={roll.coverPreset}
                    className="absolute inset-0"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-void/70 via-transparent to-void/40" />

                  <div className="absolute inset-x-0 top-0 p-4">
                    <p className="display-md line-clamp-2 text-[20px] text-chalk">{roll.name}</p>
                    <p className="tabular mt-1 flex items-center gap-1.5 text-[13px] text-chalk/70">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDuration(roll.finishesAt.getTime() - now.getTime())} left
                    </p>
                  </div>

                  <span className="absolute bottom-8 left-1/2 flex h-14 w-[72px] -translate-x-1/2 items-center justify-center rounded-2xl bg-void/70 text-chalk">
                    <Camera className="h-6 w-6" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {albums.length > 0 ? (
          <section className="border-t border-hair px-5 py-6">
            <h2 className="marking">Albums</h2>

            <div className="space-y-6">
              {albums.map((roll) => (
                <Link key={roll.id} href={`/rolls/${roll.id}`} className="mt-4 block">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="display-md text-[22px] text-chalk">{roll.name}</p>
                    <p className="tabular shrink-0 text-[13px] text-dust">
                      {formatRange(roll.startsAt, roll.finishesAt)}
                    </p>
                  </div>

                  <div className="mt-3 flex">
                    {Array.from({ length: Math.min(4, Math.max(1, roll._count.photos)) }).map(
                      (_, index) => (
                        // Only the front print is the real cover; the ones behind it stay
                        // gradients, so the stack still reads as a stack rather than as the
                        // same photograph shuffled four times.
                        <Cover
                          key={index}
                          url={index === 0 ? covers.get(roll.id) : null}
                          preset={roll.coverPreset + index}
                          className={`-ml-3 h-[104px] w-[84px] shrink-0 rounded-2xl ring-1 ring-void/60 first:ml-0 ${TILT[index % TILT.length]}`}
                        />
                      ),
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <BottomNav current="rolls" />
    </div>
  );
}
