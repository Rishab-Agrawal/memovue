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

  const event = await prisma.event.findFirst({
    where: { id, hostId: user.id },
  });
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
  const capacity = event.maxGuests * event.photosPerGuest;

  return (
    <>
      <Link
        href="/dashboard"
        className="text-[14px] text-paper-dim transition-colors hover:text-paper"
      >
        ← All events
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-display text-[2.2rem] leading-tight text-paper">{event.name}</h1>
        <EventPhaseBadge phase={phase} />
      </div>
      <p className="mt-1.5 text-[15px] text-paper-dim">
        {config.emoji} {config.label} · starts {formatDateTime(event.startsAt)}
      </p>

      {/* ------------------------------------------------------------ status */}
      <section className="safelight mt-8 rounded-lg border border-line bg-ink-raised p-6">
        {phase === "scheduled" ? (
          <>
            <p className="text-[13px] font-medium tracking-[0.16em] text-paper-dim uppercase">
              Doors open in
            </p>
            <p className="mt-2 font-display text-[2.4rem] leading-none text-paper">
              <Countdown
                target={event.startsAt.toISOString()}
                initial={formatCountdown(event.startsAt)}
              />
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-paper-dim">
              Guests can scan the code now, but they can&rsquo;t join or shoot until{" "}
              {formatDateTime(event.startsAt)}.
            </p>
          </>
        ) : phase === "capturing" ? (
          <>
            <p className="text-[13px] font-medium tracking-[0.16em] text-ember uppercase">
              Photos unlock in
            </p>
            <p className="mt-2 font-display text-[2.4rem] leading-none text-paper">
              <Countdown
                target={event.revealAt.toISOString()}
                initial={formatCountdown(event.revealAt)}
              />
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-paper-dim">
              Everyone — including you — sees the album at {formatDateTime(event.revealAt)}. Until
              then nobody can see a single photo, not even their own.
            </p>
            <div className="mt-5">
              <RevealNowButton eventId={event.id} />
            </div>
          </>
        ) : (
          <>
            <p className="text-[13px] font-medium tracking-[0.16em] text-success uppercase">
              Revealed
            </p>
            <p className="mt-2 font-display text-[2.4rem] leading-none text-paper">
              {photoCount} photo{photoCount === 1 ? "" : "s"}
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-paper-dim">
              Opened {formatDateTime(event.revealAt)}
              {event.revealedEarly ? " (revealed early by you)" : ""}. Everyone who joined can see
              the album.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
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

      {/* ------------------------------------------------------------ qr */}
      <section className="mt-6 rounded-lg border border-line bg-ink-raised p-6">
        <h2 className="text-[17px] font-medium text-paper">The code your guests scan</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-paper-dim">
          Print it for the tables, or send the link in the group chat. Guests need nothing else.
        </p>

        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
          <div
            className="w-40 shrink-0 overflow-hidden rounded-md bg-paper p-3 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-paper-dim">Join code</p>
            <p
              data-testid="join-code"
              className="font-display text-[2rem] leading-none tracking-[0.14em] text-paper"
            >
              {event.code}
            </p>
            <p className="mt-3 truncate text-[14px] text-paper-faint">{url}</p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <ButtonLink href={`/dashboard/events/${event.id}/qr`} target="_blank">
                Printable card
              </ButtonLink>
              <CopyLinkButton url={url} />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ stats */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Joined" value={`${guests.length}`} sub={`of ${event.maxGuests} max`} />
        <Stat label="Photos taken" value={`${photoCount}`} sub={`of ${capacity} possible`} />
        <Stat label="Shots each" value={`${event.photosPerGuest}`} />
        <Stat
          label="Unlocks"
          value={`${event.revealDelayHours}h`}
          sub={event.revealedEarly ? "manually revealed" : "after start"}
        />
      </section>

      {/* ------------------------------------------------------------ guests */}
      <section className="mt-6 rounded-lg border border-line bg-ink-raised p-6">
        <h2 className="text-[17px] font-medium text-paper">
          Who&rsquo;s joined{guests.length ? ` (${guests.length})` : ""}
        </h2>
        {guests.length === 0 ? (
          <p className="mt-2 text-[15px] leading-relaxed text-paper-dim">
            Nobody yet. They&rsquo;ll appear here as they scan the code.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {guests.map((guest) => (
              <li key={guest.id} className="flex items-center justify-between gap-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] text-paper">{guest.name}</span>
                  {guest.relation || guest.relationSide ? (
                    <span className="block truncate text-[13px] text-paper-faint">
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
                <span className="shrink-0 text-[14px] text-paper-dim tabular">
                  {guest._count.photos}/{event.photosPerGuest}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------------ settings */}
      <section className="mt-6 rounded-lg border border-line bg-ink-raised p-6">
        <h2 className="text-[17px] font-medium text-paper">Settings</h2>
        <dl className="mt-4 flex flex-col gap-3 text-[15px]">
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

        <div className="mt-7 border-t border-line pt-6">
          <DeleteEventButton eventId={event.id} eventName={event.name} />
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-line bg-ink-raised px-4 py-3.5">
      <p className="text-[13px] text-paper-dim">{label}</p>
      <p className="mt-1 font-display text-[1.7rem] leading-none text-paper tabular">{value}</p>
      {sub ? <p className="mt-1.5 text-[12px] text-paper-faint">{sub}</p> : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-paper-dim">{label}</dt>
      <dd className="text-paper">{children}</dd>
    </div>
  );
}
