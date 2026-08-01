import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireHost } from "@/lib/session";

import { ChangePasswordForm, DeleteAccountForm } from "./AccountForms";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireHost();

  const [eventCount, photoCount] = await Promise.all([
    prisma.event.count({ where: { hostId: user.id } }),
    prisma.photo.count({ where: { event: { hostId: user.id }, status: "READY" } }),
  ]);

  return (
    <div className="flex min-h-dvh flex-col px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-xl">
        <Link
          href="/dashboard"
          className="text-[14px] text-paper-dim transition-colors hover:text-paper"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-4 font-display text-[2.2rem] leading-tight text-paper">Account</h1>

        <section className="mt-8 rounded-lg border border-line bg-ink-raised p-6">
          <dl className="flex flex-col gap-3 text-[15px]">
            <div className="flex justify-between gap-4">
              <dt className="text-paper-dim">Name</dt>
              <dd className="text-paper">{user.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-paper-dim">Email</dt>
              <dd className="truncate text-paper">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-paper-dim">Events</dt>
              <dd className="text-paper tabular">{eventCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-paper-dim">Photos stored</dt>
              <dd className="text-paper tabular">{photoCount}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-lg border border-line bg-ink-raised p-6">
          <h2 className="text-[17px] font-medium text-paper">Change password</h2>
          <ChangePasswordForm />
        </section>

        <section className="mt-6 rounded-lg border border-danger/30 bg-ink-raised p-6">
          <h2 className="text-[17px] font-medium text-paper">Delete account</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-paper-dim">
            This removes your account, all {eventCount} of your event
            {eventCount === 1 ? "" : "s"}, and every one of the {photoCount} photo
            {photoCount === 1 ? "" : "s"} your guests took — permanently, from our servers and
            our storage. Download anything you want to keep first.
          </p>
          <DeleteAccountForm />
        </section>

        <p className="mt-8 text-center text-[14px] text-paper-faint">
          <Link href="/terms" className="hover:text-paper-dim">
            Terms
          </Link>
          {" · "}
          <Link href="/privacy" className="hover:text-paper-dim">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}
