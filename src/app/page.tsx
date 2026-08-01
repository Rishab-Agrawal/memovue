import Link from "next/link";

import { PhotoWall } from "@/components/marketing/PhotoWall";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

const STEPS = [
  {
    title: "Set it up",
    body: "Name the event, choose how many people are coming and how many shots each one gets. About a minute.",
  },
  {
    title: "Share one QR code",
    body: "Print it for the tables or drop it in the group chat. Guests scan and start shooting — no app, no account, no sign-up.",
  },
  {
    title: "Everything opens at once",
    body: "At the moment you picked, the album unlocks for everyone who was there. You get the full-resolution download.",
  },
];

const POINTS = [
  {
    title: "Nothing to install",
    body: "It's a web page. Scanning the code is the entire onboarding, for every guest, at every age.",
  },
  {
    title: "A real shot limit",
    body: "Between 3 and 25 photos each. Running out is the point — it's what makes people wait for the shot worth taking.",
  },
  {
    title: "Every photo credited",
    body: "Each frame carries the name of whoever took it, so you know who caught the moment you missed.",
  },
  {
    title: "The album is yours",
    body: "Download everything in original quality whenever you like. We'll never delete an album without telling you first.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <Link
          href="/login"
          className="text-[15px] text-paper-dim transition-colors hover:text-paper"
        >
          Sign in
        </Link>
      </header>

      <main className="flex-1">
        {/* ---------------------------------------------------------------- hero */}
        <section className="safelight px-5 pt-10 pb-20 sm:px-8 sm:pt-16">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
            <div className="animate-rise">
              <p className="mb-5 text-[13px] font-medium tracking-[0.18em] text-ember uppercase">
                A disposable camera for everyone
              </p>
              <h1 className="font-display text-[clamp(2.6rem,8.5vw,4.6rem)] leading-[0.98] text-paper">
                Nobody sees a thing
                <br />
                <em className="text-ember">until it&rsquo;s over.</em>
              </h1>
              <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-paper-dim">
                Your guests shoot the whole night on their own phones. Every photo stays sealed
                until the moment you choose — then the entire album opens at once, for everyone.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/signup" size="lg" className="sm:px-8">
                  Create an event
                </ButtonLink>
                <ButtonLink href="/join" variant="secondary" size="lg">
                  Join with a code
                </ButtonLink>
              </div>
              <p className="mt-5 text-[14px] text-paper-faint">
                Free while we&rsquo;re in beta. Hosting an event needs an invite for now.
              </p>
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute -inset-8 -z-10 bg-[radial-gradient(60%_50%_at_50%_40%,rgba(242,104,60,0.16),transparent_70%)]" />
              <PhotoWall className="mx-auto max-w-sm lg:max-w-none" />
              <p className="mt-5 text-center text-[13px] text-paper-faint">
                What guests see before the reveal
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- steps */}
        <section className="border-t border-line px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-[clamp(1.9rem,5vw,2.8rem)] leading-tight text-paper">
              How it works
            </h2>
            <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative">
                  <span
                    className="font-display text-[3.5rem] leading-none text-ember/25"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <h3 className="mt-2 text-[19px] font-medium text-paper">{step.title}</h3>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-paper-dim">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------------------------------------------------------- points */}
        <section className="border-t border-line px-5 py-20 sm:px-8">
          <div className="mx-auto grid max-w-6xl gap-x-12 gap-y-10 sm:grid-cols-2">
            {POINTS.map((point) => (
              <div key={point.title} className="border-t border-line pt-6">
                <h3 className="text-[17px] font-medium text-paper">{point.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-paper-dim">{point.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- cta */}
        <section className="safelight border-t border-line px-5 py-24 text-center sm:px-8">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-display text-[clamp(2rem,6vw,3.2rem)] leading-tight text-paper">
              Give everyone a camera.
              <br />
              <em className="text-ember">Take away the screen.</em>
            </h2>
            <div className="mt-9 flex justify-center">
              <ButtonLink href="/signup" size="lg" className="px-10">
                Create an event
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <nav className="flex flex-wrap gap-x-7 gap-y-3 text-[14px] text-paper-dim">
            <Link href="/terms" className="transition-colors hover:text-paper">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-paper">
              Privacy
            </Link>
            <Link href="/join" className="transition-colors hover:text-paper">
              Join an event
            </Link>
            <a href="mailto:hello@memovue.com" className="transition-colors hover:text-paper">
              Contact
            </a>
          </nav>
        </div>
        <p className="mx-auto mt-8 max-w-6xl text-[13px] text-paper-faint">
          © {new Date().getFullYear()} MemoVue
        </p>
      </footer>
    </div>
  );
}
