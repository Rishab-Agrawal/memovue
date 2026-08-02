import Link from "next/link";

import { ButtonLink } from "@/components/ui/Button";
import { Logo, Mark } from "@/components/ui/Logo";

const STEPS = [
  ["Create the event", "Name it and pick how many shots each guest gets."],
  ["Share one code", "Guests scan and start shooting. No app, no sign-up."],
  ["Get the album", "Every photo from everyone, in full quality."],
];

const POINTS = [
  ["Nothing to install", "It's a web page. Scanning the code is the whole setup."],
  ["A shot limit", "Three to twenty-five each, like a disposable camera."],
  ["Credited", "Every photo carries the name of whoever took it."],
  ["Revealed together", "Photos stay hidden until the time you pick, then open at once."],
  ["Yours to keep", "Download everything in original quality, whenever."],
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
              <h1 className="display animate-rise text-[clamp(3.2rem,13vw,6rem)] text-chalk">
                {/* Trailing space before the break, or the heading's text content reads
                    "Every memory,one album." to screen readers and copy-paste. */}
                Every memory,{" "}
                <br />
                <span className="text-flame">one album.</span>
              </h1>

              <p
                className="animate-rise mt-8 max-w-md text-[17px] leading-relaxed text-ash"
                style={{ animationDelay: "120ms" }}
              >
                Your guests shoot your event on their own phones. Every photo lands in one shared
                album, credited to whoever took it.
              </p>

              <div
                className="animate-rise mt-10 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8"
                style={{ animationDelay: "220ms" }}
              >
                <ButtonLink href="/signup" size="lg">
                  Create an event
                </ButtonLink>
                <Link
                  href="/join"
                  className="border-b border-hair-bright pb-1 text-[15px] text-ash transition-colors hover:border-flame hover:text-chalk"
                >
                  I have a code
                </Link>
              </div>

              <p
                className="animate-fade mt-9 text-[13px] text-dust"
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
        <section className="border-t border-hair px-6 py-16 sm:px-10">
          <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-3 sm:gap-8">
            {STEPS.map(([title, body], index) => (
              <div key={title}>
                <span className="tabular text-[13px] text-flame">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="display mt-3 text-[1.5rem] text-chalk">{title}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-ash">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- points */}
        <section className="border-t border-hair px-6 py-16 sm:px-10">
          <dl className="mx-auto max-w-6xl">
            {POINTS.map(([term, description]) => (
              <div
                key={term}
                className="grid gap-x-10 gap-y-1 border-t border-hair py-5 first:border-t-0 sm:grid-cols-[12rem_1fr] sm:items-baseline"
              >
                <dt className="text-[15px] font-medium text-chalk">{term}</dt>
                <dd className="text-[15px] leading-relaxed text-ash">{description}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---------------------------------------------------------------- cta */}
        <section className="bloom border-t border-hair px-6 py-24 sm:px-10">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-9">
            <Mark className="h-12 w-auto" glow />
            <h2 className="display max-w-2xl text-[clamp(2.4rem,8vw,3.6rem)] text-chalk">
              One night. <span className="text-flame">Everyone&rsquo;s camera.</span>
            </h2>
            <ButtonLink href="/signup" size="lg">
              Create an event
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-hair px-6 py-10 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
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
        <p className="tabular mx-auto mt-8 max-w-6xl text-[11px] text-dust">
          © {new Date().getFullYear()} MemoVue
        </p>
      </footer>
    </div>
  );
}
