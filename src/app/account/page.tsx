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
    <div className="flex min-h-dvh flex-col px-6 py-12 sm:px-10">
      <div className="mx-auto w-full max-w-xl">
        <Link href="/dashboard" className="marking transition-colors hover:text-chalk">
          ← Dashboard
        </Link>
        <h1 className="display mt-6 text-[2.6rem] text-chalk">Account</h1>

        <dl className="mt-12 border-t border-hair">
          <Row label="Name">{user.name}</Row>
          <Row label="Email">{user.email}</Row>
          <Row label="Events">
            <span className="tabular">{eventCount}</span>
          </Row>
          <Row label="Photos stored">
            <span className="tabular">{photoCount}</span>
          </Row>
        </dl>

        <section className="mt-14 border-t border-hair pt-10">
          <p className="marking">Change password</p>
          <ChangePasswordForm />
        </section>

        <section className="mt-14 border-t border-hair pt-10">
          <p className="marking text-danger">Delete account</p>
          <p className="mt-5 text-[15px] leading-relaxed text-ash">
            This removes your account, all {eventCount} of your event
            {eventCount === 1 ? "" : "s"}, and every one of the {photoCount} photo
            {photoCount === 1 ? "" : "s"} your guests took — permanently, from our servers and our
            storage. Download anything you want to keep first.
          </p>
          <DeleteAccountForm />
        </section>

        <nav className="mt-16 flex gap-8 border-t border-hair pt-8">
          <Link href="/terms" className="marking hover:text-chalk">
            Terms
          </Link>
          <Link href="/privacy" className="marking hover:text-chalk">
            Privacy
          </Link>
        </nav>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-hair py-4">
      <dt className="marking">{label}</dt>
      <dd className="truncate text-[15px] text-chalk">{children}</dd>
    </div>
  );
}
