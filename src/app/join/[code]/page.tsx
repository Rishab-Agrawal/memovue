import { redirect } from "next/navigation";

import { Countdown } from "@/components/Countdown";
import { Mark } from "@/components/ui/Logo";
import { asksRelation, eventTypeConfig, relationPromptFor } from "@/lib/event-types";
import { getEventByCode, getGuestContext } from "@/lib/guest-context";
import { prisma } from "@/lib/prisma";
import { eventPhase, formatCountdown, formatDateTime } from "@/lib/reveal";

import { JoinForm } from "./JoinForm";

export const metadata = { title: "Join an event" };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const event = await getEventByCode(code);
  if (!event) {
    return (
      <Shell title="We couldn't find that event" body="Check the code and try scanning again." />
    );
  }

  // Already in? Skip straight past the form — the common case for someone reopening the
  // page mid-event.
  const existing = await getGuestContext(code);
  if (existing) redirect(`/e/${event.code}`);

  const phase = eventPhase(event);
  const config = eventTypeConfig(event.type);

  if (phase === "scheduled") {
    return (
      <Shell title={event.name} eyebrow={config.label}>
        <p className="mt-6 text-[16px] leading-relaxed text-ash">
          This one hasn&rsquo;t started yet. Come back on{" "}
          <span className="text-chalk">{formatDateTime(event.startsAt)}</span> and scan again.
        </p>
        <p className="tabular mt-8 text-[2rem] leading-none text-flame">
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
        <p className="mt-6 text-[16px] leading-relaxed text-ash">
          Every spot has been taken. Ask the host if they can make room.
        </p>
      </Shell>
    );
  }

  const revealed = phase === "revealed";

  return (
    <Shell title={event.name} eyebrow={config.label}>
      <p className="mt-6 text-[16px] leading-relaxed text-ash">
        {/* A guest who shoots and never sees the photo needs to know why, so this stays
            explicit here even though it's played down on the marketing pages. */}
        {revealed ? (
          "The album is already open. Add your name to see everything from the night."
        ) : (
          <>
            You get <span className="tabular text-chalk">{event.photosPerGuest}</span> photos. They
            stay hidden until the album opens at{" "}
            <span className="text-chalk">{formatDateTime(event.revealAt)}</span>.
          </>
        )}
      </p>

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
    <div className="bloom flex min-h-dvh flex-col px-6 pb-16">
      <header className="py-6">
        <Mark className="h-8 w-auto" glow />
      </header>
      {/* Anchored near the top on a phone; centred only when there is room to spare. */}
      <main className="flex flex-1 flex-col pt-6 sm:justify-center sm:pt-0">
        <div className="animate-rise mx-auto w-full max-w-[24rem]">
          <h1 className="display text-[clamp(2.2rem,10vw,3rem)] text-chalk">{title}</h1>
          {/* The event type sits under the title as metadata rather than above it as a
              label — the tiny caps eyebrow over a heading is a worn-out pattern. */}
          {eyebrow ? <p className="marking mt-3">{eyebrow}</p> : null}
          {body ? <p className="mt-6 text-[16px] leading-relaxed text-ash">{body}</p> : null}
          {children}
        </div>
      </main>
    </div>
  );
}
