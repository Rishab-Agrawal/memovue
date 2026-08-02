import Link from "next/link";

import { ButtonLink } from "@/components/ui/Button";
import { Logo, Mark } from "@/components/ui/Logo";

const STEPS = [
  {
    title: "Set it up",
    body: "Name the event, choose how many people are coming and how many shots each one gets. About a minute.",
  },
  {
    title: "Share one code",
    body: "Print it for the tables or drop it in the group chat. Guests scan and start shooting — no app, no account, no sign-up.",
  },
  {
    title: "Everything opens at once",
    body: "At the moment you picked, the album unlocks for everyone who was there. You get the full-resolution download.",
  },
];

const POINTS = [
  [
    "No install",
    "It's a web page. Scanning the code is the entire onboarding, for every guest, at every age.",
  ],
  [
    "A real limit",
    "Between 3 and 25 shots each. Running out is the point — it's what makes people wait for the frame worth taking.",
  ],
  [
    "Credited",
    "Every frame carries the name of whoever took it, so you know who caught the moment you missed.",
  ],
  [
    "Yours",
    "Download everything in original quality whenever you like. We'll never delete an album without telling you first.",
  ],
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
        <section className="bloom px-6 pt-14 pb-16 sm:px-10 sm:pt-24 sm:pb-24">
          <div className="mx-auto grid max-w-6xl gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-8">
            <div>
              <p className="marking animate-fade text-flame">Everyone's camera · one album</p>

              {/* The trailing spaces matter: without them the heading's text content runs
                  together as "Nobody seesa thing until…" for screen readers and copy-paste. */}
              <h1 className="display mt-7 text-[clamp(3rem,12vw,5.5rem)] text-chalk">
                <span className="animate-rise block">Nobody sees </span>
                <span className="animate-rise block" style={{ animationDelay: "90ms" }}>
                  a thing until{" "}
                </span>
                <span
                  className="animate-rise block text-flame"
                  style={{ animationDelay: "180ms" }}
                >
                  it&rsquo;s over.
                </span>
              </h1>

              <p
                className="animate-rise mt-8 max-w-md text-[17px] leading-relaxed text-ash"
                style={{ animationDelay: "280ms" }}
              >
                Your guests shoot the whole night on their own phones. Every photo stays sealed —
                from them, from you, from everyone — until the moment you chose. Then the entire
                album opens at once.
              </p>

              <div
                className="animate-rise mt-11 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8"
                style={{ animationDelay: "360ms" }}
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
                className="animate-fade mt-10 text-[13px] text-dust"
                style={{ animationDelay: "500ms" }}
              >
                Free while we&rsquo;re in beta. Hosting needs an invite for now.
              </p>
            </div>

            {/* The mark is the hero image. Four viewpoints, one root — it draws itself in. */}
            <div className="order-first flex justify-center lg:order-last lg:justify-end">
              <Mark animate glow className="h-48 w-auto sm:h-60 lg:h-72" />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- steps */}
        <section className="border-t border-hair px-6 py-20 sm:px-10">
          <div className="mx-auto max-w-6xl">
            <p className="marking">How it works</p>

            <ol className="mt-10">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="grid gap-x-10 gap-y-3 border-t border-hair py-9 sm:grid-cols-[4rem_1fr_1.2fr] sm:items-baseline"
                >
                  <span className="tabular text-[13px] text-flame">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h2 className="display text-[1.9rem] text-chalk">{step.title}</h2>
                  <p className="max-w-md text-[16px] leading-relaxed text-ash">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------------------------------------------------------- points */}
        <section className="border-t border-hair px-6 py-20 sm:px-10">
          <div className="mx-auto max-w-6xl">
            <p className="marking">Why it works</p>

            <dl className="mt-10">
              {POINTS.map(([term, description]) => (
                <div
                  key={term}
                  className="grid gap-x-10 gap-y-2 border-t border-hair py-7 sm:grid-cols-[10rem_1fr] sm:items-baseline"
                >
                  <dt className="text-[15px] font-medium text-chalk">{term}</dt>
                  <dd className="max-w-xl text-[16px] leading-relaxed text-ash">{description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ---------------------------------------------------------------- cta */}
        <section className="bloom border-t border-hair px-6 py-28 sm:px-10">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-10">
            <Mark className="h-14 w-auto" glow />
            <h2 className="display max-w-2xl text-[clamp(2.4rem,8vw,4rem)] text-chalk">
              Give everyone a camera.
              <br />
              <span className="text-flame">Take away the screen.</span>
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
