import Link from "next/link";

import { ButtonLink } from "@/components/ui/Button";
import { Logo, Mark } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";

/*
  The marketing page.

  It diverges from the reference app in one structural way: every call to action here — header,
  hero, closing — points at the welcome screen. The reference app replaces its marketing site
  with its welcome screen entirely; ours cannot, because this page is what explains the
  product. Unifying the calls to action is how the two meet.
*/

const STEPS: { title: string; body: string; shot: string }[] = [
  {
    title: "Set it up",
    body: "Create the roll, choosing the number of guests, shots, event dates and duration.",
    shot: "/frames/roll-creation.jpg",
  },
  {
    title: "Share one code",
    body: "Print it for the tables or send it in the group chat. Guests scan and start shooting - no app, no sign-up.",
    shot: "/frames/roll-invite.jpg",
  },
];

/*
  A screenshot of the app, in a phone.

  Not next/image, for the same reason as everywhere else here: these are fixed local files and
  the optimiser would proxy them through our own server to no benefit.

  `half` drops the top edge, so the frame runs off the top of whatever holds it. The step
  screenshots are themselves crops of a screen, and a closed bezel drawn around a cropped
  screen reads as a broken phone rather than a phone you are looking partway into.
*/
function Phone({ src, className, half }: { src: string; className?: string; half?: boolean }) {
  return (
    <div
      className={cn(
        "overflow-hidden border border-hair-bright bg-void p-[3px] shadow-[0_28px_56px_rgba(0,0,0,0.65)]",
        half ? "rounded-b-[1.9rem] border-t-0" : "rounded-[2.3rem]",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={cn("block w-full", half ? "rounded-b-[1.7rem]" : "rounded-[2.1rem]")}
      />
    </div>
  );
}

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
                <ButtonLink href="/welcome" size="lg">
                  Get started
                </ButtonLink>
              </div>
            </div>

            {/*
              The camera a guest is handed and the album a host gets back — the two ends of the
              product, overlapped the way two phones on a table are. The album sits in front,
              because it is the thing being sold; the camera is only how it fills up.

              The tilt sits on the phones
              rather than on the wrapper because `animate-rise` finishes on `transform: none`,
              which would wipe a rotation sharing that element.
            */}
            <div className="order-first flex justify-center lg:order-last lg:justify-end">
              <div
                className="animate-rise flex w-full max-w-[23rem] items-start"
                style={{ animationDelay: "160ms" }}
              >
                <Phone src="/frames/camera-screen-bday.jpg" className="w-[58%] -rotate-6" />
                <Phone
                  src="/frames/roll-home.jpg"
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
                <Phone src={step.shot} half className="mx-auto mt-7 w-[80%] max-w-[15rem]" />
                <h2 className="display-md mt-9 text-[1.7rem] text-chalk">{step.title}</h2>
                <p className="mt-3 text-[16px] leading-relaxed text-ash">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------------------------------------------------------- reveal */}
        <section className="border-t border-hair px-6 py-20 sm:px-10 sm:py-28">
          {/*
            Both columns size to their content rather than splitting the row, so the phone sits
            beside the sentence instead of at the far edge of the container. `1fr` for the text
            left a hole in the middle: the prose is capped at `max-w-md` and cannot fill it.
          */}
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[auto_auto] lg:items-center lg:justify-start lg:gap-40">
            <div>
              <h2 className="display max-w-md text-[clamp(2rem,7vw,3rem)] text-chalk">
                A lasting <span className="text-flame">experience</span>
              </h2>
              <p className="mt-6 max-w-md text-[16px] leading-relaxed text-ash">
                The photos reveal together, giving the perfect end to your event.
              </p>
            </div>

            {/* The sealed roll as a host actually sees it, rather than a drawing of one. */}
            <Phone
              src="/frames/roll-pre-reveal.jpg"
              className="mx-auto w-full max-w-[15rem] lg:max-w-[17rem]"
            />
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
            <ButtonLink href="/welcome" size="lg" className="mt-2">
              Get started
            </ButtonLink>
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
