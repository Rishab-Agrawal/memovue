import Link from "next/link";

import { PillLink } from "@/components/roll/Chrome";
import { Logo, Mark } from "@/components/ui/Logo";
import { Phone } from "@/components/ui/Phone";
import { SealedAlbum } from "@/components/ui/SealedAlbum";

/* The marketing page. Every call to action points at the welcome screen. */

const STEPS: { title: string; body: string; shot: string; height: number }[] = [
  {
    title: "Set it up",
    body: "Create the roll, choosing the number of guests, shots, event dates and duration.",
    shot: "/frames/roll-creation.jpg",
    height: 878,
  },
  {
    title: "Share one code",
    body: "Print it for the tables or send it in the group chat. Guests scan and start shooting - no app, no sign-up.",
    shot: "/frames/roll-invite.jpg",
    height: 866,
  },
];

export default function MarketingHome() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-hair px-6 py-3 sm:px-10">
        <Link href="/" aria-label="MemoVue home" className="flex h-11 items-center">
          <Logo />
        </Link>
        <Link
          href="/welcome"
          className="marking flex h-11 items-center px-1 transition-colors hover:text-chalk"
        >
          Get started
        </Link>
      </header>

      <main className="flex-1">
        {/* ---------------------------------------------------------------- hero */}
        <section className="bloom px-6 pt-16 pb-20 sm:px-10 sm:pt-24 sm:pb-28">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
            <div className="text-center">
              <h1 className="display animate-rise text-[clamp(3rem,12vw,5.5rem)] text-chalk">
                Every memory,{" "}
                <br />
                <span className="text-flame">one album.</span>
              </h1>

              <p
                className="animate-rise mx-auto mt-7 max-w-md text-[17px] leading-relaxed text-ash"
                style={{ animationDelay: "120ms" }}
              >
                Your guests shoot your event on their own phones. Every photo lands in one shared
                album, revealed after the event.
              </p>

              <div
                className="animate-rise mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
                style={{ animationDelay: "220ms" }}
              >
                <PillLink href="/welcome" variant="flame" className="rounded-none">
                  Get started
                </PillLink>
              </div>
            </div>

            {/* Camera and album, overlapped. The tilt is on the phones because `animate-rise` ends on `transform: none`. */}
            <div className="order-first flex justify-center lg:order-last lg:justify-end">
              <div
                className="animate-rise flex w-full max-w-[23rem] items-start"
                style={{ animationDelay: "160ms" }}
              >
                <Phone
                  src="/frames/camera-screen-bday.jpg"
                  width={716}
                  height={1283}
                  className="w-[58%] -rotate-6"
                />
                <Phone
                  src="/frames/roll-home.jpg"
                  width={720}
                  height={1383}
                  className="mt-[16%] -ml-[16%] w-[58%] rotate-[5deg]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- steps */}
        <section className="border-t border-hair px-6 py-20 sm:px-10 sm:py-24">
          <p className="marking mx-auto max-w-5xl text-ash">How it works</p>
          <ol className="mx-auto mt-8 grid max-w-5xl gap-8 sm:grid-cols-2">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="overflow-hidden rounded-3xl border border-hair bg-surface/50 px-6 pt-8 pb-9 sm:px-8"
              >
                <p className="marking tabular text-dust">Step 0{index + 1}</p>
                <Phone
                  src={step.shot}
                  width={720}
                  height={step.height}
                  half
                  className="mx-auto mt-7 w-[80%] max-w-[15rem]"
                />
                <h2 className="display-md mt-9 text-[1.7rem] text-chalk">{step.title}</h2>
                <p className="mt-3 text-[16px] leading-relaxed text-ash">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------------------------------------------------------- reveal */}
        <section className="border-t border-hair px-6 py-20 sm:px-10 sm:py-28">
          {/* Both columns size to content, so the phone sits beside the capped-width prose. */}
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[auto_auto] lg:items-center lg:justify-start lg:gap-40">
            <div>
              <h2 className="display max-w-md text-[clamp(2rem,7vw,3rem)] text-chalk">
                A lasting <span className="text-flame">experience</span>
              </h2>
              <p className="mt-6 max-w-md text-[16px] leading-relaxed text-ash">
                The photos reveal together, giving the perfect end to your event.
              </p>
            </div>

            <Phone className="mx-auto w-[15rem] lg:w-[17rem]">
              <SealedAlbum />
            </Phone>
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
              You can&rsquo;t be in every room. Your guests are.
            </p>
            <PillLink href="/welcome" variant="flame" className="mt-2 rounded-none">
              Get started
            </PillLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-hair px-6 py-8 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <nav className="flex flex-wrap gap-x-6 gap-y-1">
            {[
              ["Terms", "/terms"],
              ["Privacy", "/privacy"],
              ["Join", "/join"],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="marking flex h-11 items-center px-1 transition-colors hover:text-chalk"
              >
                {label}
              </Link>
            ))}
            <a
              href="mailto:hello@memovue.com"
              className="marking flex h-11 items-center px-1 transition-colors hover:text-chalk"
            >
              Contact
            </a>
          </nav>
        </div>
        <p className="tabular mx-auto mt-6 max-w-5xl text-[12px] text-dust">
          © {new Date().getFullYear()} MemoVue
        </p>
      </footer>
    </div>
  );
}
