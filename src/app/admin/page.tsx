import Link from "next/link";

import { emailEnabled } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/reveal";
import { requireAdmin } from "@/lib/session";

import { AccessDecision, DeleteInviteCode, InviteCodeForm } from "./AdminControls";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();

  const [requests, codes, eventCount, guestCount, photoCount] = await Promise.all([
    prisma.accessRequest.findMany({
      where: { status: "REQUESTED" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.inviteCode.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.event.count(),
    prisma.guest.count(),
    prisma.photo.count({ where: { status: "READY" } }),
  ]);

  return (
    <div className="flex min-h-dvh flex-col px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <Link
          href="/dashboard"
          className="text-[14px] text-paper-dim transition-colors hover:text-paper"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-4 font-display text-[2.2rem] leading-tight text-paper">Admin</h1>

        {!emailEnabled ? (
          <p className="mt-5 rounded-md border border-marigold/35 bg-marigold/8 px-4 py-3 text-[14px] leading-relaxed text-marigold">
            No <code>RESEND_API_KEY</code> is set, so approval emails aren&rsquo;t being sent —
            hosts will only find out by signing back in. Add the key to turn them on.
          </p>
        ) : null}

        <section className="mt-8 grid grid-cols-3 gap-3">
          <Stat label="Events" value={eventCount} />
          <Stat label="Guests" value={guestCount} />
          <Stat label="Photos" value={photoCount} />
        </section>

        {/* ---------------------------------------------------------- requests */}
        <section className="mt-8 rounded-lg border border-line bg-ink-raised p-6">
          <h2 className="text-[17px] font-medium text-paper">
            Waiting for approval{requests.length ? ` (${requests.length})` : ""}
          </h2>

          {requests.length === 0 ? (
            <p className="mt-2 text-[15px] text-paper-dim">Nobody waiting right now.</p>
          ) : (
            <ul className="mt-5 flex flex-col gap-5">
              {requests.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-[16px] text-paper">
                      {request.user.name}{" "}
                      <span className="text-[14px] text-paper-faint">{request.user.email}</span>
                    </p>
                    <p className="mt-1 text-[15px] text-paper-dim">{request.eventKind}</p>
                    <p className="mt-1 text-[13px] text-paper-faint">
                      {[
                        request.expectedDate,
                        request.guestEstimate ? `${request.guestEstimate} people` : null,
                        request.phone,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No extra details"}
                    </p>
                    {request.note ? (
                      <p className="mt-2 text-[14px] leading-relaxed text-paper-dim italic">
                        “{request.note}”
                      </p>
                    ) : null}
                    <p className="mt-2 text-[12px] text-paper-faint">
                      Asked {formatDateTime(request.createdAt)}
                    </p>
                  </div>
                  <AccessDecision userId={request.user.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------------------------------------------------------- invites */}
        <section className="mt-6 rounded-lg border border-line bg-ink-raised p-6">
          <h2 className="text-[17px] font-medium text-paper">Invite codes</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-paper-dim">
            Hand one of these to a host you&rsquo;ve already spoken to — they sign up with it and
            can create events immediately, no queue.
          </p>

          <InviteCodeForm />

          {codes.length > 0 ? (
            <ul className="mt-7 divide-y divide-line border-t border-line">
              {codes.map((code) => {
                const spent = code.uses >= code.maxUses;
                return (
                  <li key={code.id} className="flex items-center justify-between gap-4 py-3">
                    <span className="min-w-0">
                      <span
                        className={`block font-display text-[1.35rem] tracking-[0.14em] ${
                          spent ? "text-paper-faint line-through" : "text-paper"
                        }`}
                      >
                        {code.code}
                      </span>
                      <span className="block truncate text-[13px] text-paper-faint">
                        {code.note ?? "No note"} · {code.uses}/{code.maxUses} used
                      </span>
                    </span>
                    <DeleteInviteCode id={code.id} />
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-ink-raised px-4 py-3.5">
      <p className="text-[13px] text-paper-dim">{label}</p>
      <p className="mt-1 font-display text-[1.7rem] leading-none text-paper tabular">{value}</p>
    </div>
  );
}
