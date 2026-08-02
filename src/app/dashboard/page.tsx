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
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="marking text-flame">Your events</p>
          <h1 className="display mt-4 text-[2.6rem] text-chalk">
            {events.length === 0 ? "Nothing yet" : `${events.length} event${events.length === 1 ? "" : "s"}`}
          </h1>
        </div>
        {events.length > 0 ? <ButtonLink href="/dashboard/new">New event</ButtonLink> : null}
      </div>

      {events.length === 0 ? (
        <div className="mt-14 border-t border-hair pt-10">
          <p className="max-w-sm text-[16px] leading-relaxed text-ash">
            Set up your first event and we&rsquo;ll give you a QR code to put in front of your
            guests. It takes about a minute.
          </p>
          <ButtonLink href="/dashboard/new" size="lg" className="mt-8">
            Create an event
          </ButtonLink>
        </div>
      ) : (
        // An index, not a stack of cards: shared hairlines, aligned columns.
        <ul className="mt-12 border-t border-hair">
          {events.map((event) => {
            const phase = eventPhase(event);
            return (
              <li key={event.id}>
                <Link
                  href={`/dashboard/events/${event.id}`}
                  className="group grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-2 border-b border-hair py-6 transition-colors hover:bg-surface"
                >
                  <span className="min-w-0">
                    <span className="display block truncate text-[1.5rem] text-chalk transition-colors group-hover:text-flame">
                      {event.name}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <EventPhaseBadge phase={phase} />
                      <span className="marking text-dust">
                        {eventTypeConfig(event.type).label}
                      </span>
                      <span className="marking text-dust">{formatDateTime(event.startsAt)}</span>
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="tabular block text-[1.25rem] leading-none text-chalk">
                      {event._count.photos}
                    </span>
                    <span className="marking mt-1.5 block text-dust">
                      {event._count.guests} guests
                    </span>
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
      <div className="max-w-xl">
        <p className="marking text-flame">Request received</p>
        <h1 className="display mt-5 text-[2.8rem] text-chalk">You&rsquo;re on the list</h1>
        <p className="mt-6 text-[16px] leading-relaxed text-ash">
          We approve hosts by hand while MemoVue is in beta — usually within a day. We&rsquo;ll
          email you at the address on this account the moment you&rsquo;re in.
        </p>
        <p className="mt-8 border-t border-hair pt-6 text-[15px] text-dust">
          In a hurry?{" "}
          <a
            href="mailto:hello@memovue.com"
            className="border-b border-flame/35 text-flame hover:border-flame"
          >
            Email us
          </a>{" "}
          and we&rsquo;ll bump you up.
        </p>
      </div>
    );
  }

  if (status === "DENIED") {
    return (
      <div className="max-w-xl">
        <h1 className="display text-[2.4rem] text-chalk">We couldn&rsquo;t approve this account</h1>
        <p className="mt-6 text-[16px] leading-relaxed text-ash">
          If you think that&rsquo;s a mistake, write to{" "}
          <a
            href="mailto:hello@memovue.com"
            className="border-b border-flame/35 text-flame hover:border-flame"
          >
            hello@memovue.com
          </a>{" "}
          and we&rsquo;ll take another look.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <p className="marking text-flame">Beta access</p>
      <h1 className="display mt-5 text-[2.6rem] text-chalk">
        Hi {name.split(" ")[0]} — tell us about your event
      </h1>
      <p className="mt-6 text-[16px] leading-relaxed text-ash">
        MemoVue is free while we&rsquo;re in beta, and we let hosts in by hand so we can keep an
        eye on every event. Two minutes now, and we&rsquo;ll usually have you set up within a day.
      </p>
      <AccessRequestForm />
    </div>
  );
}
