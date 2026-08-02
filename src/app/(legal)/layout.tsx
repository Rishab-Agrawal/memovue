import Link from "next/link";

import { Logo } from "@/components/ui/Logo";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-hair px-6 py-5 sm:px-10">
        <Link href="/" aria-label="MemoVue home">
          <Logo />
        </Link>
      </header>

      <main className="flex-1 px-6 py-16 sm:px-10">
        <article
          className={[
            "mx-auto max-w-[38rem]",
            // Prose styling lives here rather than in every legal page, so the two
            // documents can stay as readable JSX.
            "[&_h1]:display [&_h1]:text-[2.8rem] [&_h1]:text-chalk",
            "[&_h2]:mt-14 [&_h2]:display [&_h2]:text-[1.5rem] [&_h2]:text-chalk",
            "[&_p]:mt-5 [&_p]:text-[16px] [&_p]:leading-[1.75] [&_p]:text-ash",
            "[&_ul]:mt-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-4",
            "[&_li]:relative [&_li]:pl-6 [&_li]:text-[16px] [&_li]:leading-[1.75] [&_li]:text-ash",
            // A small orange rule as the bullet, echoing the mark's stems.
            "[&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[0.85em]",
            "[&_li]:before:h-px [&_li]:before:w-3 [&_li]:before:bg-flame [&_li]:before:content-['']",
            "[&_strong]:font-medium [&_strong]:text-chalk",
            "[&_a]:text-flame [&_a]:border-b [&_a]:border-flame/35 hover:[&_a]:border-flame",
          ].join(" ")}
        >
          {children}
        </article>
      </main>

      <footer className="border-t border-hair px-6 py-10 sm:px-10">
        <nav className="mx-auto flex max-w-[38rem] gap-8">
          <Link href="/terms" className="marking hover:text-chalk">
            Terms
          </Link>
          <Link href="/privacy" className="marking hover:text-chalk">
            Privacy
          </Link>
          <a href="mailto:hello@memovue.com" className="marking hover:text-chalk">
            Contact
          </a>
        </nav>
      </footer>
    </div>
  );
}
