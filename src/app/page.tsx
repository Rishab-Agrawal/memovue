import Link from "next/link";

import { ButtonLink } from "@/components/ui/Button";
import { Logo, Mark } from "@/components/ui/Logo";

const STEPS: [string, string][] = [
  [
    "Set it up",
    "Name your event and choose how many shots each guest gets. It takes about a minute.",
  ],
  [
    "Share one code",
    "Print it for the tables or send it in the group chat. Guests scan and start shooting — no app, no sign-up.",
  ],
  ["Get the album", "Every photo, from every guest, in one place and in full quality."],
];

/**
 * Shown one at a time, so each can be a whole statement rather than a fragment. `accent`
 * is the phrase set in orange — kept as a substring of `text` rather than pre-split markup
 * so the copy stays readable and editable as a plain sentence.
 *
 * Changing how many of these there are also means retiming `.rotator` in globals.css.
 */
const STATEMENTS: { text: string; accent: string }[] = [
  { text: "Guests join via QR code, no install hassle.", accent: "QR code" },
  {
    text: "Up to twenty-five shots each, like a disposable camera.",
    accent: "disposable camera",
  },
  { text: "Photos revealed all at once after the event.", accent: "revealed" },
  { text: "Suited for weddings, parties, team outings, and more.", accent: "weddings" },
];

function withAccent(text: string, accent: string) {
  const at = text.indexOf(accent);
  if (at === -1) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className="text-flame">{accent}</span>
      {text.slice(at + accent.length)}
    </>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-hair px-6 py-5 sm:px-10">
        <Logo />
        <Link href="/login" className="marking transition-colors hover:text-chalk">
          Sign in
        </Link>
      </header>

      <main className="flex-1">
        {/* ---------------------------------------------------------------- hero */}
        <section className="bloom px-6 pt-16 pb-20 sm:px-10 sm:pt-24 sm:pb-28">
          <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-8">
            <div>
              <h1 className="display animate-rise text-[clamp(3rem,12vw,5.5rem)] text-chalk">
                {/* Trailing space before the break, or the heading's text content reads
                    "Every memory,one album." to screen readers and copy-paste. */}
                Every memory,{" "}
                <br />
                <span className="text-flame">one album.</span>
              </h1>

              <p
                className="animate-rise mt-7 max-w-md text-[17px] leading-relaxed text-ash"
                style={{ animationDelay: "120ms" }}
              >
                Your guests shoot your event on their own phones. Every photo lands in one shared
                album, credited to whoever took it.
              </p>

              <div
                className="animate-rise mt-9 flex flex-wrap items-center gap-x-7 gap-y-4"
                style={{ animationDelay: "220ms" }}
              >
                <ButtonLink href="/signup">Create an event</ButtonLink>
                <Link
                  href="/join"
                  className="border-b border-hair-bright pb-1 text-[14px] text-ash transition-colors hover:border-flame hover:text-chalk"
                >
                  I have a code
                </Link>
              </div>

              <p
                className="animate-fade mt-8 text-[13px] text-dust"
                style={{ animationDelay: "340ms" }}
              >
                Free while we&rsquo;re in beta.
              </p>
            </div>

            {/* The mark is the hero image. Four viewpoints, one root — it draws itself in. */}
            <div className="order-first flex justify-center lg:order-last lg:justify-end">
              <Mark animate glow className="h-44 w-auto sm:h-56 lg:h-72" />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- steps */}
        <section className="border-t border-hair px-6 sm:px-10">
          <div className="mx-auto max-w-5xl">
            {STEPS.map(([title, body]) => (
              <div
                key={title}
                className="grid gap-x-14 gap-y-3 border-b border-hair py-11 last:border-b-0 sm:grid-cols-[1fr_1.5fr] sm:items-baseline"
              >
                <h2 className="display text-[1.7rem] text-chalk">{title}</h2>
                <p className="text-[16px] leading-relaxed text-ash">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- statements */}
        {/* A section in its own right: one statement at a time, held for a beat. Every item
            stays in the DOM and unhidden, so a screen reader gets all six regardless of
            which one is currently visible. */}
        <section className="border-y border-hair px-6 py-24 sm:px-10 sm:py-32">
          <ul className="rotator mx-auto max-w-5xl">
            {STATEMENTS.map((statement, index) => (
              <li
                key={statement.text}
                className="rotator__item display max-w-2xl text-[clamp(1.8rem,6.5vw,2.8rem)] text-chalk"
                style={{ ["--slot" as string]: index }}
              >
                {withAccent(statement.text, statement.accent)}
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------------------------------------------------------- closing */}
        <section className="bloom px-6 py-24 sm:px-10">
          <div className="mx-auto flex max-w-5xl flex-col items-start gap-7">
            <Mark className="h-11 w-auto" glow />
            <h2 className="display max-w-xl text-[clamp(2.2rem,7vw,3.4rem)] text-chalk">
              The parts you <span className="text-flame">missed.</span>
            </h2>
            <p className="max-w-sm text-[16px] leading-relaxed text-ash">
              You can&rsquo;t be in every room. Your guests are.
            </p>
            <ButtonLink href="/signup" className="mt-2">
              Create an event
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-hair px-6 py-10 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <nav className="flex flex-wrap gap-x-8 gap-y-3">
            <Link href="/terms" className="marking transition-colors hover:text-chalk">
              Terms
            </Link>
            <Link href="/privacy" className="marking transition-colors hover:text-chalk">
              Privacy
            </Link>
            <Link href="/join" className="marking transition-colors hover:text-chalk">
              Join
            </Link>
            <a href="mailto:hello@memovue.com" className="marking transition-colors hover:text-chalk">
              Contact
            </a>
          </nav>
        </div>
        <p className="tabular mx-auto mt-8 max-w-5xl text-[11px] text-dust">
          © {new Date().getFullYear()} MemoVue
        </p>
      </footer>
    </div>
  );
}
