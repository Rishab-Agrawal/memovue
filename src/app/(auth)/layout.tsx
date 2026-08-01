import Link from "next/link";

import { Logo } from "@/components/ui/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="safelight flex min-h-dvh flex-col">
      <header className="px-5 py-5 sm:px-8">
        <Link href="/" aria-label="MemoVue home">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pt-6 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-[26rem] animate-rise">{children}</div>
      </main>
    </div>
  );
}
