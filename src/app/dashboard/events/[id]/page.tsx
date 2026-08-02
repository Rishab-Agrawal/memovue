import Link from "next/link";
import { notFound } from "next/navigation";

import { Countdown } from "@/components/Countdown";
import { EventPhaseBadge } from "@/components/EventPhaseBadge";
import { ButtonLink } from "@/components/ui/Button";
import { asksRelation, eventTypeConfig } from "@/lib/event-types";
import { prisma } from "@/lib/prisma";
import { joinUrl, qrSvg } from "@/lib/qr";
import { eventPhase, formatCountdown, formatDateTime } from "@/lib/reveal";
import { requireHost } from "@/lib/session";

import { CopyLinkButton, DeleteEventButton, RevealNowButton } from "./EventControls";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireHost();

  const event = await prisma.event.findFirst({ where: { id, hostId: user.id } });
  if (!event) notFound();

  const [guests, photoCount, qr] = await Promise.all([
    prisma.guest.findMany({
      where: { eventId: id },
      orderBy: { name: "asc" },
      include: { _count: { select: { photos: { where: { status: "READY" } } } } },
    }),
    prisma.photo.count({ where: { eventId: id, status: "READY" } }),
    qrSvg(event.code),
  ]);

  const phase = eventPhase(event);
  const config = eventTypeConfig(event.type);
  const url = joinUrl(event.code);

  return (
    <>
      <Link href="/dashboard" className="marking transition-colors hover:text-chalk">
        ← All events
      </Link>

      <h1 className="display mt-6 text-[2.6rem] leading-[1.05] text-chalk">{event.name}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <EventPhaseBadge phase={phase} />
        <span className="marking text-dust">{config.label}</span>
        <span className="marking text-dust">Starts {formatDateTime(event.startsAt)}</span>
      </div>

      {/* ------------------------------------------------------------ status */}
      <section className="bloom mt-14 border-t border-hair pt-10">
        {phase === "scheduled" ? (
          <>
            <p className="marking">Doors open in</p>
            <p className="tabular mt-4 text-[2.6rem] leading-none text-chalk">
              <Countdown
                target={event.startsAt.toISOString()}
                initial={formatCountdown(event.startsAt)}
              />
            </p>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-ash">
              Guests can scan the code now, but they can&rsquo;t join or shoot until{" "}
              {formatDateTime(event.startsAt)}.
            </p>
          </>
        ) : phase === "capturing" ? (
          <>
            <p className="marking text-flame">Photos unlock in</p>
            <p className="tabular mt-4 text-[2.6rem] leading-none text-chalk">
              <Countdown
                target={event.revealAt.toISOString()}
                initial={formatCountdown(event.revealAt)}
              />
            </p>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-ash">
              Everyone — including you — sees the album at {formatDateTime(event.revealAt)}. Until
              then nobody can see a single photo, not even their own.
            </p>
            <div className="mt-8">
              <RevealNowButton eventId={event.id} />
            </div>
          </>
        ) : (
          <>
            <p className="marking text-success">Revealed</p>
            {/* The count is data and belongs in mono; the noun is prose and doesn't. */}
            <p className="mt-4 flex items-baseline gap-3 text-chalk">
              <span data-testid="revealed-count" className="tabular text-[2.6rem] leading-none">
                {photoCount}
              </span>
              <span className="display text-[1.5rem]">
                photo{photoCount === 1 ? "" : "s"}
              </span>
            </p>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-ash">
              Opened {formatDateTime(event.revealAt)}
              {event.revealedEarly ? ", revealed early by you" : ""}. Everyone who joined can see
              the album.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <ButtonLink href={`/e/${event.code}`}>Open the album</ButtonLink>
              {photoCount > 0 ? (
                <ButtonLink
                  href={`/api/events/${event.id}/download`}
                  variant="secondary"
                  prefetch={false}
                >
                  Download everything
                </ButtonLink>
              ) : null}
            </div>
          </>
        )}
      </section>

      {/* ------------------------------------------------------------ numbers */}
      <section className="mt-14 border-t border-hair">
        <dl className="grid grid-cols-2 sm:grid-cols-4">
          <Stat label="Joined" value={guests.length} sub={`of ${event.maxGuests}`} />
          <Stat label="Photos" value={photoCount} sub={`of ${event.maxGuests * event.photosPerGuest}`} />
          <Stat label="Shots each" value={event.photosPerGuest} />
          <Stat
            label="Unlocks after"
            value={`${event.revealDelayHours}h`}
            sub={event.revealedEarly ? "revealed early" : undefined}
          />
        </dl>
      </section>

      {/* ------------------------------------------------------------ qr */}
      <section className="mt-12 pt-2">
        <p className="marking">The code your guests scan</p>

        <div className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-start">
          {/* Deliberately light: a dark QR is unreliable to scan across a dim room. */}
          <div
            className="w-40 shrink-0 bg-chalk p-3 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <div className="min-w-0 flex-1">
            <p className="marking">Join code</p>
            <p
              data-testid="join-code"
              className="tabular mt-2 text-[2.1rem] leading-none tracking-[0.18em] text-flame"
            >
              {event.code}
            </p>
            <p className="mt-4 truncate text-[13px] text-dust">{url}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href={`/dashboard/events/${event.id}/qr`} target="_blank" size="sm">
                Printable card
              </ButtonLink>
              <CopyLinkButton url={url} />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ guests */}
      <section className="mt-14 border-t border-hair pt-10">
        <p className="marking">
          Who&rsquo;s joined{guests.length ? ` · ${guests.length}` : ""}
        </p>

        {guests.length === 0 ? (
          <p className="mt-5 text-[15px] leading-relaxed text-ash">
            Nobody yet. They&rsquo;ll appear here as they scan the code.
          </p>
        ) : (
          <ul className="mt-6 border-t border-hair">
            {guests.map((guest) => (
              <li
                key={guest.id}
                className="flex items-baseline justify-between gap-5 border-b border-hair py-4"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[16px] text-chalk">{guest.name}</span>
                  {guest.relation || guest.relationSide ? (
                    <span className="marking mt-1 block truncate text-dust">
                      {[
                        guest.relationSide === "BOTH"
                          ? "Both"
                          : guest.relationSide === "A"
                            ? event.partnerA
                            : guest.relationSide === "B"
                              ? event.partnerB
                              : null,
                        guest.relation,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : null}
                </span>
                <span className="tabular shrink-0 text-[14px] text-ash">
                  {guest._count.photos}/{event.photosPerGuest}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------------ settings */}
      <section className="mt-14 border-t border-hair pt-10">
        <p className="marking">Settings</p>
        <dl className="mt-6 border-t border-hair">
          <Row label="Guests are asked">
            {asksRelation(event.type, event.askRelation)
              ? "Their name, and how they know you"
              : "Their name only"}
          </Row>
          {event.partnerA ? (
            <Row label="Sides">
              {event.partnerA}
              {event.partnerB ? ` · ${event.partnerB}` : ""}
            </Row>
          ) : null}
          {event.honoreeName ? <Row label="Guest of honour">{event.honoreeName}</Row> : null}
          <Row label="Photos unlock">{formatDateTime(event.revealAt)}</Row>
        </dl>

        <div className="mt-10">
          <DeleteEventButton eventId={event.id} eventName={event.name} />
        </div>
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="border-b border-hair py-6 pr-6">
      <dt className="marking">{label}</dt>
      <dd className="tabular mt-2.5 text-[1.6rem] leading-none text-chalk">
        {value}
        {sub ? <span className="ml-2 text-[12px] text-dust">{sub}</span> : null}
      </dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-3 border-b border-hair py-4">
      <dt className="marking">{label}</dt>
      <dd className="text-[15px] text-chalk">{children}</dd>
    </div>
  );
}
