"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Logo } from "@/components/ui/Logo";

import { BottomNav } from "../components/BottomNav";
import { PillLink } from "../components/Chrome";
import { Camera, Clock, Qr } from "../components/Icons";
import { Plate } from "../components/Plate";
import { formatRange } from "../format";
import { FILM, NOW, PAST_ALBUM } from "../mock";
import { formatCountdown } from "../rules";

/** Just enough tilt to read as separate prints rather than one strip. */
const TILT = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2"];

export default function HostHome() {
  const empty = useSearchParams().get("v") === "empty";

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <header className="flex items-center justify-between px-5 pt-6 pb-4">
          <Link href="/proto/home" aria-label="MemoVue home" className="flex h-11 items-center">
            <Logo />
          </Link>

          <div className="flex items-center gap-2">
            <PillLink href="/proto/join" variant="quiet" className="h-10 px-4 text-[14px]">
              <Qr className="h-4 w-4" />
              Join
            </PillLink>
            <PillLink
              href="/proto/new/name"
              variant="light"
              className="h-10 px-4 text-[14px] font-semibold"
            >
              + New
            </PillLink>
          </div>
        </header>

        {/* ------------------------------------------------------------ active */}
        <section className="px-5 pb-8">
          <h2 className="marking">Active</h2>

          {empty ? (
            <div className="flex flex-col items-center gap-5 py-16">
              <span className="h-7 w-7 rounded-full bg-hair-bright" />
              <p className="text-[15px] text-dust">No active films</p>
              <PillLink href="/proto/new/name" variant="flame">
                + Create film
              </PillLink>
            </div>
          ) : (
            <Link
              href="/proto/film"
              className="relative mt-4 block h-[260px] w-[200px] overflow-hidden rounded-3xl"
            >
              <Plate index={0} className="absolute inset-0" />
              <div className="absolute inset-0 bg-gradient-to-b from-void/70 via-transparent to-void/40" />

              <div className="absolute inset-x-0 top-0 p-4">
                <p className="display-md line-clamp-2 text-[20px] text-chalk">{FILM.title}</p>
                <p className="tabular mt-1 flex items-center gap-1.5 text-[13px] text-chalk/70">
                  <Clock className="h-3.5 w-3.5" />
                  {formatCountdown(FILM.finishAt.getTime() - NOW.getTime())}
                </p>
              </div>

              <span className="absolute bottom-8 left-1/2 flex h-14 w-[72px] -translate-x-1/2 items-center justify-center rounded-2xl bg-void/70 text-chalk">
                <Camera className="h-6 w-6" />
              </span>
            </Link>
          )}
        </section>

        {/* ------------------------------------------------------------ albums */}
        <section className="border-t border-hair px-5 py-6">
          <h2 className="marking">Albums</h2>

          <Link href="/proto/guest/album?v=after-everyone" className="mt-4 block">
            <div className="flex items-baseline justify-between gap-4">
              <p className="display-md text-[22px] text-chalk">{PAST_ALBUM.title}</p>
              <p className="tabular shrink-0 text-[13px] text-dust">
                {formatRange(PAST_ALBUM.from, PAST_ALBUM.to)}
              </p>
            </div>

            {/* Fanned, like a handful of prints put down on a table. */}
            <div className="mt-3 flex">
              {PAST_ALBUM.plates.map((plate, index) => (
                <Plate
                  key={index}
                  index={plate}
                  className={`-ml-3 h-[104px] w-[84px] shrink-0 rounded-2xl ring-1 ring-void/60 first:ml-0 ${TILT[index % TILT.length]}`}
                />
              ))}
            </div>
          </Link>
        </section>
      </div>

      <BottomNav current="films" />
    </div>
  );
}
