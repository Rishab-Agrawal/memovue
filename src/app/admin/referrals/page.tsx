import { notFound } from "next/navigation";

import { BackButton } from "@/components/roll/Chrome";
import { REFERRALS } from "@/lib/constants";
import { listReferrers } from "@/lib/referrals";
import { requireAdmin } from "@/lib/session";

import { ReferrerList } from "./ReferrerList";

export const metadata = { title: "Referral codes" };
export const dynamic = "force-dynamic";

/**
 * The wedding businesses that send hosts here, and the code each one hands out.
 *
 * Unlike the beta list next door, nothing here is spent: a code is a name a roll wears, so the
 * only numbers on this screen are how many rolls each business has brought in.
 */
export default async function ReferralsPage() {
  await requireAdmin();
  // Switched off, so the screen that manages it is not a screen.
  if (!REFERRALS) notFound();

  const referrers = await listReferrers();

  return (
    <div className="min-h-dvh px-5 pt-4 pb-10">
      <BackButton href="/account" />

      <h1 className="display mt-5 text-[30px] text-chalk">Referral codes</h1>
      <p className="mt-2 text-[15px] text-ash">
        A host who types one of these gets that business named on their roll&rsquo;s home screen,
        where every guest looking at the album sees it.
      </p>

      <ReferrerList
        rows={referrers.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          url: row.url,
          email: row.email,
          logoUrl: row.logoUrl,
          rolls: row._count.rolls,
        }))}
      />
    </div>
  );
}
