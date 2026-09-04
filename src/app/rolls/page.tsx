import Link from "next/link";

import { Logo } from "@/components/ui/Logo";
import { BottomNav } from "@/components/roll/BottomNav";
import { PillLink } from "@/components/roll/Chrome";
import { Cover } from "@/components/roll/Cover";
import { Plate } from "@/components/roll/Plate";
import { Camera, Clock, Person, Qr } from "@/components/roll/Icons";
import { canCreateRoll } from "@/lib/beta";
import { formatDuration, formatRange } from "@/lib/format";
import { type RollCard, coverUrlsFor, listRollsForUser } from "@/lib/rolls";
import { requireHost } from "@/lib/session";

import { NewRollButton } from "./NewRollButton";

export const metadata = { title: "Your rolls" };
export const dynamic = "force-dynamic";

/** Just enough tilt to read as separate prints rather than one strip. */
const TILT = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2"];

/** Matches the number of thumbnails `listRollsForUser` signs, so the two cannot drift. */
const STACK = TILT.length;

/** Your own roll opens the host screen; one you were invited to opens the camera. */
const destination = (roll: RollCard) =>
  roll.invitedBy ? `/e/${roll.code}` : `/rolls/${roll.id}`;

export default async function RollsHome() {
  const user = await requireHost();
  const [{ active, albums }, canCreate] = await Promise.all([
    listRollsForUser(user.id),
    canCreateRoll(user),
  ]);
  // Only the active cards stand on a cover now; albums show their own prints below.
  const covers = coverUrlsFor(active);
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
            <NewRollButton
              canCreate={canCreate}
              hostName={user.name}
              variant="light"
              className="h-10 px-4 text-[14px] font-semibold"
            >
              + New
            </NewRollButton>
          </div>
        </header>

        <section className="px-5 pb-8">
          <h2 className="marking">Active</h2>

          {active.length === 0 ? (
            <Empty note="No active rolls">
              <NewRollButton canCreate={canCreate} hostName={user.name} variant="flame">
                + Create roll
              </NewRollButton>
            </Empty>
          ) : (
            <div className="mt-4 flex gap-4 overflow-x-auto no-scrollbar">
              {active.map((roll) => (
                <Link
                  key={roll.id}
                  href={destination(roll)}
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

                  {roll.invitedBy ? <InvitedBy name={roll.invitedBy} /> : null}

                  <span className="absolute bottom-8 left-1/2 flex h-14 w-[72px] -translate-x-1/2 items-center justify-center rounded-2xl bg-void/70 text-chalk">
                    <Camera className="h-6 w-6" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/*
          The heading stands whether or not there is anything under it. Hiding the section
          until the first roll finishes left the screen with one lonely block and a wide
          emptiness beneath it, and gave a new host no idea that finished rolls go anywhere.
        */}
        <section className="border-t border-hair px-5 py-6">
          <h2 className="marking">Albums</h2>

          {albums.length === 0 ? (
            <Empty note="No albums yet">
              <p className="max-w-[16rem] text-center text-[13px] leading-relaxed text-dust">
                A roll becomes an album once it closes.
              </p>
            </Empty>
          ) : (
            <div className="space-y-6">
              {albums.map((roll) => (
                <Link key={roll.id} href={destination(roll)} className="mt-4 block">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="display-md text-[22px] text-chalk">{roll.name}</p>
                    <p className="tabular shrink-0 text-[13px] text-dust">
                      {formatRange(roll.startsAt, roll.finishesAt)}
                    </p>
                  </div>

                  {roll.invitedBy ? (
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] text-dust">
                      <Person className="h-3.5 w-3.5" />
                      Invited by {roll.invitedBy}
                    </p>
                  ) : null}

                  {/*
                    The album's own photographs. This stack used to be shipped cover artwork,
                    walked one preset per print — four pictures of strangers' weddings standing
                    in for the album you actually shot, which is worse than showing nothing.

                    Washes when there is nothing to show: an album still sealed, or one nobody
                    put a frame in. A wash says "a picture you cannot see yet"; stock
                    photography says "your photographs, loaded".
                  */}
                  <div className="mt-3 flex">
                    {roll.thumbs.length > 0
                      ? roll.thumbs.map((url, index) => (
                          <div
                            key={url}
                            className={`relative -ml-3 h-[104px] w-[84px] shrink-0 overflow-hidden rounded-2xl bg-void ring-1 ring-void/60 first:ml-0 ${TILT[index % TILT.length]}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="h-full w-full object-cover" />
                          </div>
                        ))
                      : Array.from({ length: Math.min(STACK, Math.max(1, roll.photoCount)) }).map(
                          (_, index) => (
                            <Plate
                              key={index}
                              index={roll.coverPreset + index}
                              className={`-ml-3 h-[104px] w-[84px] shrink-0 rounded-2xl ring-1 ring-void/60 first:ml-0 ${TILT[index % TILT.length]}`}
                            />
                          ),
                        )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <BottomNav current="rolls" />
    </div>
  );
}

/** Both empty states, so the two sections sit at the same height and read as a pair. */
function Empty({ note, children }: { note: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-5 py-14">
      <p className="text-[15px] text-dust">{note}</p>
      {children}
    </div>
  );
}

function InvitedBy({ name }: { name: string }) {
  return (
    <span className="absolute top-[68px] left-4 flex max-w-[168px] items-center gap-1.5 rounded-full bg-void/60 px-2.5 py-1 text-[12px] text-chalk/85 backdrop-blur-sm">
      <Person className="h-3 w-3 shrink-0" />
      <span className="truncate">Invited by {name}</span>
    </span>
  );
}
