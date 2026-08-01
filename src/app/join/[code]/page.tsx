import { redirect } from "next/navigation";

import { Countdown } from "@/components/Countdown";
import { Logo } from "@/components/ui/Logo";
import { asksRelation, eventTypeConfig, relationPromptFor } from "@/lib/event-types";
import { getEventByCode, getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { eventPhase, formatCountdown, formatDateTime } from "@/lib/reveal";

import { JoinForm } from "./JoinForm";

export const metadata = { title: "Join an event" };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const event = await getEventByCode(code);
  if (!event) return <Shell title="We couldn't find that event" body="Check the code and try scanning again." />;

  // Already in? Skip straight past the form — this is the common case for someone
  // reopening the page mid-event.
  const existing = await getGuestContext(code);
  if (existing) redirect(`/e/${event.code}`);

  const phase = eventPhase(event);
  const config = eventTypeConfig(event.type);

  if (phase === "scheduled") {
    return (
      <Shell title={event.name} eyebrow={`${config.emoji} ${config.label}`}>
        <p className="text-[16px] leading-relaxed text-paper-dim">
          This one hasn&rsquo;t started yet. Come back on{" "}
          <span className="text-paper">{formatDateTime(event.startsAt)}</span> and scan again.
        </p>
        <p className="mt-6 font-display text-[2rem] leading-none text-ember">
          <Countdown
            target={event.startsAt.toISOString()}
            initial={formatCountdown(event.startsAt)}
          />
        </p>
      </Shell>
    );
  }

  const guestCount = await prisma.guest.count({ where: { eventId: event.id } });
  if (guestCount >= event.maxGuests) {
    return (
      <Shell title="This event is full" eyebrow={event.name}>
        <p className="text-[16px] leading-relaxed text-paper-dim">
          Every spot has been taken. Ask the host if they can make room.
        </p>
      </Shell>
    );
  }

  const revealed = phase === "revealed";

  return (
    <Shell
      title={event.name}
      eyebrow={`${config.emoji} ${config.label}`}
      body={
        revealed
          ? "The album is already open. Add your name to see everything from the night."
          : `You get ${event.photosPerGuest} photos. Nobody sees any of them — not even you — until they all unlock at ${formatDateTime(event.revealAt)}.`
      }
    >
      <JoinForm
        config={{
          code: event.code,
          relationMode: config.relation,
          asksRelation: !revealed && asksRelation(event.type, event.askRelation),
          relationPrompt: relationPromptFor(event.type, event),
          partnerA: event.partnerA,
          partnerB: event.partnerB,
          viewOnly: revealed,
        }}
      />
    </Shell>
  );
}

function Shell({
  title,
  eyebrow,
  body,
  children,
}: {
  title: string;
  eyebrow?: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="safelight flex min-h-dvh flex-col px-5 pb-12">
      <header className="py-5">
        <Logo />
      </header>
      <main className="flex flex-1 flex-col justify-center">
        <div className="mx-auto w-full max-w-[26rem] animate-rise">
          {eyebrow ? (
            <p className="text-[13px] font-medium tracking-[0.16em] text-ember uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-3 font-display text-[clamp(2.2rem,9vw,3rem)] leading-[1.05] text-paper">
            {title}
          </h1>
          {body ? (
            <p className="mt-4 text-[16px] leading-relaxed text-paper-dim">{body}</p>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}
