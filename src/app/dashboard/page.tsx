import Link from "next/link";

import { EventPhaseBadge } from "@/components/EventPhaseBadge";
import { ButtonLink } from "@/components/ui/Button";
import { eventTypeConfig } from "@/lib/event-types";
import { prisma } from "@/lib/prisma";
import { eventPhase, formatDateTime } from "@/lib/reveal";
import { canCreateEvents, requireHost } from "@/lib/session";

import { AccessRequestForm } from "./AccessRequestForm";

export const metadata = { title: "Your events" };

export default async function DashboardPage() {
  const user = await requireHost();

  if (!canCreateEvents(user)) {
    return <AccessGate status={user.accessStatus} name={user.name} />;
  }

  const events = await prisma.event.findMany({
    where: { hostId: user.id },
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { guests: true, photos: true } } },
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-[2.2rem] leading-tight text-paper">Your events</h1>
        {events.length > 0 ? <ButtonLink href="/dashboard/new">New event</ButtonLink> : null}
      </div>

      {events.length === 0 ? (
        <div className="mt-10 rounded-lg border border-line bg-ink-raised px-6 py-14 text-center">
          <h2 className="font-display text-[1.6rem] text-paper">Nothing here yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-paper-dim">
            Set up your first event and we&rsquo;ll give you a QR code to put in front of your
            guests.
          </p>
          <div className="mt-7 flex justify-center">
            <ButtonLink href="/dashboard/new" size="lg" className="px-8">
              Create an event
            </ButtonLink>
          </div>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {events.map((event) => {
            const config = eventTypeConfig(event.type);
            const phase = eventPhase(event);
            return (
              <li key={event.id}>
                <Link
                  href={`/dashboard/events/${event.id}`}
                  className="group flex items-center gap-4 rounded-lg border border-line bg-ink-raised p-4 transition-colors hover:border-line-bright sm:p-5"
                >
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-ink-high text-[20px]"
                    aria-hidden="true"
                  >
                    {config.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="truncate text-[17px] font-medium text-paper">
                        {event.name}
                      </span>
                      <EventPhaseBadge phase={phase} />
                    </span>
                    <span className="mt-1 block text-[14px] text-paper-dim">
                      {formatDateTime(event.startsAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[13px] text-paper-faint tabular">
                    <span className="block">{event._count.guests} guests</span>
                    <span className="block">{event._count.photos} photos</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function AccessGate({ status, name }: { status: string; name: string }) {
  if (status === "REQUESTED") {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <p className="text-[13px] font-medium tracking-[0.18em] text-ember uppercase">
          Request received
        </p>
        <h1 className="mt-4 font-display text-[2.4rem] leading-tight text-paper">
          You&rsquo;re on the list
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-paper-dim">
          We approve hosts by hand while MemoVue is in beta — usually within a day. We&rsquo;ll
          email you at the address on this account the moment you&rsquo;re in.
        </p>
        <p className="mt-6 text-[15px] text-paper-faint">
          In a hurry?{" "}
          <a href="mailto:hello@memovue.com" className="text-ember hover:underline">
            Email us
          </a>{" "}
          and we&rsquo;ll bump you up.
        </p>
      </div>
    );
  }

  if (status === "DENIED") {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <h1 className="font-display text-[2.2rem] leading-tight text-paper">
          We couldn&rsquo;t approve this account
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-paper-dim">
          If you think that&rsquo;s a mistake, reply to us at{" "}
          <a href="mailto:hello@memovue.com" className="text-ember hover:underline">
            hello@memovue.com
          </a>{" "}
          and we&rsquo;ll take another look.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-[13px] font-medium tracking-[0.18em] text-ember uppercase">Beta access</p>
      <h1 className="mt-4 font-display text-[2.4rem] leading-tight text-paper">
        Hi {name.split(" ")[0]} — tell us about your event
      </h1>
      <p className="mt-4 text-[16px] leading-relaxed text-paper-dim">
        MemoVue is free while we&rsquo;re in beta, and we let hosts in by hand so we can keep an
        eye on every event. Two minutes now, and we&rsquo;ll usually have you set up within a day.
      </p>
      <AccessRequestForm />
    </div>
  );
}
