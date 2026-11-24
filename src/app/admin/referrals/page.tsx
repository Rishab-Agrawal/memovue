import type { CodeKind } from "@prisma/client";

import { BackButton } from "@/components/roll/Chrome";
import { formatDayYear } from "@/lib/format";
import { isSpent, listRedemptions, listReferrers, listRequests } from "@/lib/referrals";
import { requireAdmin } from "@/lib/session";

import { Codes } from "./Codes";

export const metadata = { title: "Referral codes" };
export const dynamic = "force-dynamic";

/** Who is asking for a code, then the codes: every roll is created with one. */
export default async function ReferralsPage() {
  await requireAdmin();

  const [referrers, redemptions, requests] = await Promise.all([
    listReferrers(),
    listRedemptions(),
    listRequests(),
  ]);

  const lists = (kind: CodeKind) => ({
    unused: referrers.filter((row) => row.kind === kind && !isSpent(row)),
    uses: redemptions.filter((use) => use.referrer.kind === kind),
  });

  return (
    <div className="min-h-dvh px-5 pt-4 pb-10">
      <BackButton href="/account" />

      <h1 className="display mt-5 text-[30px] text-chalk">Referral codes</h1>
      <p className="mt-2 text-[15px] text-ash">
        Every roll is created with one. A code is never given back when its roll is deleted.
      </p>

      <section className="mt-10">
        <p className="marking">Requests · {requests.length}</p>

        {requests.length === 0 ? (
          <p className="mt-3 text-[14px] text-dust">Nobody has asked yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-hair border-t border-hair">
            {requests.map((request) => (
              <li key={request.id} className="py-3">
                <div className="flex items-baseline justify-between gap-4">
                  {/* Unabbreviated: it is where the code gets sent. */}
                  <span className="text-[15px] break-all text-chalk">{request.email}</span>
                  <span className="tabular shrink-0 text-[13px] text-dust">
                    {formatDayYear(request.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Codes lists={{ INDIVIDUAL: lists("INDIVIDUAL"), BUSINESS: lists("BUSINESS") }} />
    </div>
  );
}
