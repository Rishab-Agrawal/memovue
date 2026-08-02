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
    <div className="flex min-h-dvh flex-col px-6 py-12 sm:px-10">
      <div className="mx-auto w-full max-w-4xl">
        <Link href="/dashboard" className="marking transition-colors hover:text-chalk">
          ← Dashboard
        </Link>
        <h1 className="display mt-6 text-[2.6rem] text-chalk">Admin</h1>

        {!emailEnabled ? (
          <p className="mt-8 max-w-xl border-l-2 border-flame py-1 pl-5 text-[14px] leading-relaxed text-ash">
            No <code className="tabular text-flame">RESEND_API_KEY</code> is set, so approval
            emails aren&rsquo;t being sent — hosts will only find out by signing back in.
          </p>
        ) : null}

        <dl className="mt-12 grid grid-cols-3 border-t border-hair">
          <Stat label="Events" value={eventCount} />
          <Stat label="Guests" value={guestCount} />
          <Stat label="Photos" value={photoCount} />
        </dl>

        {/* ---------------------------------------------------------- requests */}
        <section className="mt-14 border-t border-hair pt-10">
          <p className="marking">
            Waiting for approval{requests.length ? ` · ${requests.length}` : ""}
          </p>

          {requests.length === 0 ? (
            <p className="mt-5 text-[15px] text-ash">Nobody waiting right now.</p>
          ) : (
            <ul className="mt-6 border-t border-hair">
              {requests.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-col gap-5 border-b border-hair py-6 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-[17px] text-chalk">{request.user.name}</p>
                    <p className="marking mt-1 text-dust">{request.user.email}</p>
                    <p className="mt-3 text-[15px] text-ash">{request.eventKind}</p>
                    <p className="marking mt-2 text-dust">
                      {[
                        request.expectedDate,
                        request.guestEstimate ? `${request.guestEstimate} people` : null,
                        request.phone,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No extra details"}
                    </p>
                    {request.note ? (
                      <p className="mt-3 border-l border-hair-bright pl-4 text-[14px] leading-relaxed text-ash italic">
                        {request.note}
                      </p>
                    ) : null}
                    <p className="marking mt-3 text-dust">
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
        <section className="mt-14 border-t border-hair pt-10">
          <p className="marking">Invite codes</p>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ash">
            Hand one of these to a host you&rsquo;ve already spoken to — they sign up with it and
            can create events immediately, no queue.
          </p>

          <InviteCodeForm />

          {codes.length > 0 ? (
            <ul className="mt-12 border-t border-hair">
              {codes.map((code) => {
                const spent = code.uses >= code.maxUses;
                return (
                  <li
                    key={code.id}
                    className="flex items-baseline justify-between gap-5 border-b border-hair py-4"
                  >
                    <span className="min-w-0">
                      <span
                        className={`tabular block text-[1.2rem] tracking-[0.18em] ${
                          spent ? "text-dust line-through" : "text-flame"
                        }`}
                      >
                        {code.code}
                      </span>
                      <span className="marking mt-1.5 block truncate text-dust">
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
    <div className="border-b border-hair py-6 pr-6">
      <dt className="marking">{label}</dt>
      <dd className="tabular mt-2.5 text-[1.6rem] leading-none text-chalk">{value}</dd>
    </div>
  );
}
