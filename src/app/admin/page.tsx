import { BackButton } from "@/components/roll/Chrome";
import { listCoupons } from "@/lib/coupons";
import { formatDayYear } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

import { MintForm } from "./MintForm";

export const metadata = { title: "Coupons" };
export const dynamic = "force-dynamic";

/**
 * This used to be an approvals queue: people asked for beta access and an admin let them in.
 * With Google sign-in anyone can hold an account, so the gate moved to creating a roll — and
 * this screen moved with it, from deciding who may sign up to minting the codes that let
 * someone make something.
 */
export default async function AdminPage() {
  await requireAdmin();
  const coupons = await listCoupons();

  const unused = coupons.filter((coupon) => !coupon.redeemedAt);
  const spent = coupons.filter((coupon) => coupon.redeemedAt);

  return (
    <div className="min-h-dvh px-5 pt-4 pb-10">
      <BackButton href="/account" />

      <h1 className="display mt-5 text-[30px] text-chalk">Coupons</h1>
      <p className="mt-2 text-[15px] text-ash">
        Each code creates exactly one roll, then burns.
      </p>

      <MintForm />

      <section className="mt-10">
        <p className="marking">Unused · {unused.length}</p>
        {unused.length === 0 ? (
          <p className="mt-3 text-[14px] text-dust">None left. Mint some above.</p>
        ) : (
          <ul className="mt-3 divide-y divide-hair border-t border-hair">
            {unused.map((coupon) => (
              <li key={coupon.id} className="flex items-center justify-between gap-4 py-3">
                <span className="tabular text-[16px] tracking-[0.1em] text-chalk">
                  {coupon.code}
                </span>
                <span className="text-[13px] text-dust">
                  {coupon.note || formatDayYear(coupon.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <p className="marking">Spent · {spent.length}</p>
        {spent.length === 0 ? (
          <p className="mt-3 text-[14px] text-dust">Nobody has used one yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-hair border-t border-hair">
            {spent.map((coupon) => (
              <li key={coupon.id} className="py-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="tabular text-[15px] tracking-[0.1em] text-dust line-through">
                    {coupon.code}
                  </span>
                  <span className="tabular text-[13px] text-dust">
                    {coupon.redeemedAt ? formatDayYear(coupon.redeemedAt) : ""}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-ash">
                  {coupon.redeemedBy?.name ?? "unknown"}
                  {coupon.redeemedBy?.email ? ` · ${coupon.redeemedBy.email}` : ""}
                  {coupon.roll ? ` · ${coupon.roll.name}` : " · roll since deleted"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
