import type { CodeKind } from "@prisma/client";

import { BackButton } from "@/components/roll/Chrome";
import { formatDayYear } from "@/lib/format";
import { isSpent, listRedemptions, listReferrers, listRequests } from "@/lib/referrals";
import { requireAdmin } from "@/lib/session";

import { ReferrerList } from "./ReferrerList";

export const metadata = { title: "Referral codes" };
export const dynamic = "force-dynamic";

/** Who may create a roll: every roll is created with one of these codes. Then who is asking for one. */
export default async function ReferralsPage() {
  await requireAdmin();

  const [referrers, redemptions, requests] = await Promise.all([
    listReferrers(),
    listRedemptions(),
    listRequests(),
  ]);

  const lists = (kind: CodeKind) => ({
    kind,
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
        <h2 className="display-sm text-[20px] text-chalk">Individuals</h2>
        <p className="mt-1 text-[14px] text-ash">One roll each.</p>
        <ReferrerList {...lists("INDIVIDUAL")} />
      </section>

      <section className="mt-12">
        <h2 className="display-sm text-[20px] text-chalk">Businesses</h2>
        <p className="mt-1 text-[14px] text-ash">
          As many rolls as you allow, each naming the business on its home screen.
        </p>
        <ReferrerList {...lists("BUSINESS")} />
      </section>

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
    </div>
  );
}
