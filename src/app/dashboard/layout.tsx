import Link from "next/link";

import { Logo } from "@/components/ui/Logo";
import { requireHost } from "@/lib/session";

import { logoutAction } from "../(auth)/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireHost();

  return (
    <div className="flex min-h-dvh flex-col">
      {/*
        Translucent, with the page running underneath rather than a solid strip sitting on
        top of it — and every nav item is a 44px target. A 12px tracked label with no padding
        gave these a thirteen-pixel-tall hit area on a phone, which is a coin flip between
        "Account" and "Sign out".
      */}
      <header className="sticky top-0 z-40 border-b border-hair bg-page/75 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-1.5 sm:px-10">
          <Link
            href="/dashboard"
            aria-label="MemoVue dashboard"
            className="flex h-11 items-center pr-2"
          >
            {/* The nav needs the width on a phone; the mark alone still identifies us. */}
            <Logo wordmarkClassName="hidden sm:inline" />
          </Link>
          <nav className="flex items-center gap-4 sm:gap-6">
            {user.role === "ADMIN" ? (
              <Link
                href="/admin"
                className="marking flex h-11 items-center px-1 transition-colors hover:text-chalk"
              >
                Admin
              </Link>
            ) : null}
            <Link
              href="/account"
              className="marking flex h-11 items-center px-1 transition-colors hover:text-chalk"
            >
              Account
            </Link>
            <form action={logoutAction} className="flex">
              <button
                type="submit"
                className="marking flex h-11 items-center px-1 transition-colors hover:text-chalk"
              >
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
