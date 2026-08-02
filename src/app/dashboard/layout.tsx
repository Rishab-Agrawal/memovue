import Link from "next/link";

import { Logo } from "@/components/ui/Logo";
import { requireHost } from "@/lib/session";

import { logoutAction } from "../(auth)/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireHost();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-hair bg-void/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4 sm:px-10">
          <Link href="/dashboard" aria-label="MemoVue dashboard">
            {/* The nav needs the width on a phone; the mark alone still identifies us. */}
            <Logo wordmarkClassName="hidden sm:inline" />
          </Link>
          <nav className="flex items-center gap-5 sm:gap-6">
            {user.role === "ADMIN" ? (
              <Link href="/admin" className="marking transition-colors hover:text-chalk">
                Admin
              </Link>
            ) : null}
            <Link href="/account" className="marking transition-colors hover:text-chalk">
              Account
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="marking transition-colors hover:text-chalk">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-6 py-12 sm:px-10">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
