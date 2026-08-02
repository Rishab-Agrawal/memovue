import Link from "next/link";

import { Logo } from "@/components/ui/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bloom flex min-h-dvh flex-col">
      <header className="border-b border-hair px-6 py-5 sm:px-10">
        <Link href="/" aria-label="MemoVue home">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-start px-6 pt-14 pb-20 sm:px-10 sm:items-center sm:pt-0">
        <div className="animate-rise mx-auto w-full max-w-[24rem]">{children}</div>
      </main>
    </div>
  );
}
