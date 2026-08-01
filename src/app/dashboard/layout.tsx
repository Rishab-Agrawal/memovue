import Link from "next/link";

import { Logo } from "@/components/ui/Logo";
import { requireHost } from "@/lib/session";

import { logoutAction } from "../(auth)/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireHost();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Link href="/dashboard" aria-label="MemoVue dashboard">
            <Logo />
          </Link>
          <nav className="flex items-center gap-5 text-[14px] text-paper-dim">
            {user.role === "ADMIN" ? (
              <Link href="/admin" className="transition-colors hover:text-paper">
                Admin
              </Link>
            ) : null}
            <Link href="/account" className="transition-colors hover:text-paper">
              Account
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="transition-colors hover:text-paper">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-5 py-9 sm:px-8">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
