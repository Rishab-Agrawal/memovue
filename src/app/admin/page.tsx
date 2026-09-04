import { BackButton } from "@/components/roll/Chrome";
import { listAccess, listRequests } from "@/lib/beta";
import { formatDayYear } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

import { AccessList } from "./AccessList";

export const metadata = { title: "Beta access" };
export const dynamic = "force-dynamic";

/**
 * Who may create a roll.
 *
 * This screen has now been three things. It began as an approvals queue for signing up, then
 * became a mint for single-use coupon codes, and is now an allow-list of email addresses with
 * a counter each. The code was the part that never worked: it had to be copied out of here and
 * carried to somebody over a channel we do not own, and if they burned one on a roll they
 * immediately deleted there was no way to hand it back. An address needs no handover — the
 * person signs in with Google and arrives as somebody already on this page.
 */
export default async function AdminPage() {
  await requireAdmin();
  const [access, requests] = await Promise.all([listAccess(), listRequests()]);

  return (
    <div className="min-h-dvh px-5 pt-4 pb-10">
      <BackButton href="/account" />

      <h1 className="display mt-5 text-[30px] text-chalk">Beta access</h1>
      <p className="mt-2 text-[15px] text-ash">
        Each address can create as many rolls as its counter says. Deleting a roll before its
        event starts gives one back.
      </p>

      <AccessList rows={access.map(({ id, email, rollsLeft }) => ({ id, email, rollsLeft }))} />

      <section className="mt-10">
        <p className="marking">Requests · {requests.length}</p>

        {requests.length === 0 ? (
          <p className="mt-3 text-[14px] text-dust">Nobody has asked yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-hair border-t border-hair">
            {requests.map((request) => (
              <li key={request.id} className="py-3">
                <div className="flex items-baseline justify-between gap-4">
                  {/* The address, first and unabbreviated: it is the string that gets typed
                      into the field above, and a truncated one would be typed in wrong. */}
                  <span className="text-[15px] break-all text-chalk">{request.email}</span>
                  <span className="tabular shrink-0 text-[13px] text-dust">
                    {formatDayYear(request.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-ash">
                  {request.name} · {request.eventType}
                  {request.phone ? ` · ${request.phone}` : ""}
                </p>
                {request.remarks ? (
                  <p className="mt-1 text-[13px] text-dust">{request.remarks}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
