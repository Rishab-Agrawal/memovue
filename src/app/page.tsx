import Link from "next/link";

import { Sketch, type SketchName } from "@/components/marketing/Sketch";
import { ButtonLink } from "@/components/ui/Button";
import { Logo, Mark } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";

const STEPS: { sketch: SketchName; title: string; body: string }[] = [
  {
    sketch: "plan",
    title: "Set it up",
    body: "Name your event and choose how many shots each guest gets. It takes about a minute.",
  },
  {
    sketch: "scan",
    title: "Share one code",
    body: "Print it for the tables or send it in the group chat. Guests scan and start shooting — no app, no sign-up.",
  },
  {
    sketch: "album",
    title: "Get the album",
    body: "Every photo, from every guest, in one place and in full quality.",
  },
];

const POINTS: [string, string][] = [
  ["Nothing to install", "It's a web page."],
  ["A shot limit", "Three to twenty-five each."],
  ["Credited", "Each photo carries its photographer's name."],
  ["Revealed together", "Photos stay hidden until the time you pick."],
  ["Yours to keep", "Download it all in original quality."],
  ["Up to 500 guests", "Built for a full wedding."],
];

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
        <section className="border-t border-hair px-6 py-4 sm:px-10">
          <div className="mx-auto max-w-5xl">
            {STEPS.map((step, index) => (
              <div
                key={step.title}
                className={cn(
                  "flex flex-col gap-7 border-b border-hair py-14 last:border-b-0 sm:flex-row sm:items-center sm:gap-16",
                  // Alternating sides so the section never settles into a symmetric grid.
                  index % 2 === 1 && "sm:flex-row-reverse",
                )}
              >
                {/* On a phone the row direction can't alternate, so the drawing shifts
                    side instead — otherwise all three steps stack identically. */}
                <Sketch
                  name={step.sketch}
                  className={cn(
                    "w-36 shrink-0 sm:w-48",
                    index % 2 === 1 && "self-end sm:self-auto",
                  )}
                />
                <div className={cn("sm:max-w-md", index % 2 === 1 && "sm:text-right")}>
                  <h2 className="display text-[1.75rem] text-chalk">{step.title}</h2>
                  <p className="mt-3 text-[16px] leading-relaxed text-ash">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- points */}
        {/* Deliberately quiet and dense: small type, tight rows. The contrast in scale is
            what stops this reading as a second run of the section above it. */}
        <section className="border-t border-hair px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-5xl">
            <p className="marking">Also worth knowing</p>
            <ul className="mt-7 grid gap-x-12 sm:grid-cols-2">
              {POINTS.map(([term, description]) => (
                <li
                  key={term}
                  className="border-t border-hair py-3.5 text-[14px] leading-snug"
                >
                  <span className="text-chalk">{term}</span>
                  <span className="text-dust"> — {description}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------------------------------------------------------- closing */}
        <section className="bloom border-t border-hair px-6 py-24 sm:px-10">
          <div className="mx-auto flex max-w-5xl flex-col items-start gap-7">
            <Mark className="h-11 w-auto" glow />
            <h2 className="display max-w-xl text-[clamp(2.2rem,7vw,3.4rem)] text-chalk">
              The parts you <span className="text-flame">missed.</span>
            </h2>
            <p className="max-w-sm text-[16px] leading-relaxed text-ash">
              You can&rsquo;t be in every room. Your guests already are.
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
