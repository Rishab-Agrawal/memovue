import Link from "next/link";

import { Logo } from "@/components/ui/Logo";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line px-5 py-5 sm:px-8">
        <Link href="/" aria-label="MemoVue home">
          <Logo />
        </Link>
      </header>

      <main className="flex-1 px-5 py-12 sm:px-8">
        <article
          className={[
            "mx-auto max-w-2xl",
            "[&_h1]:font-display [&_h1]:text-[2.4rem] [&_h1]:leading-tight [&_h1]:text-paper",
            "[&_h2]:mt-11 [&_h2]:text-[19px] [&_h2]:font-medium [&_h2]:text-paper",
            "[&_p]:mt-4 [&_p]:text-[16px] [&_p]:leading-relaxed [&_p]:text-paper-dim",
            "[&_ul]:mt-4 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2.5",
            "[&_li]:text-[16px] [&_li]:leading-relaxed [&_li]:text-paper-dim",
            "[&_li]:pl-5 [&_li]:relative",
            "[&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:text-ember [&_li]:before:content-['—']",
            "[&_strong]:text-paper [&_strong]:font-medium",
            "[&_a]:text-ember hover:[&_a]:underline",
          ].join(" ")}
        >
          {children}
        </article>
      </main>

      <footer className="border-t border-line px-5 py-8 sm:px-8">
        <nav className="mx-auto flex max-w-2xl gap-6 text-[14px] text-paper-dim">
          <Link href="/terms" className="hover:text-paper">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-paper">
            Privacy
          </Link>
          <a href="mailto:hello@memovue.com" className="hover:text-paper">
            Contact
          </a>
        </nav>
      </footer>
    </div>
  );
}
